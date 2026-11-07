"""API tests for game posts, lobbies and discovery (BE2).

Most tests run inside a transaction that is rolled back. The concurrency test
at the bottom commits real rows (it needs separate connections) and cleans up.
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, get_db
from app.main import app
from app.models.game import Game, GameParticipant
from app.models.user import User
from app.routers import games as games_router
from app.security import create_access_token, hash_password

HOUR = timedelta(hours=1)


def now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Fixtures / helpers
# --------------------------------------------------------------------------


@pytest.fixture
def ctx():
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        ) as session:

            def override_get_db():
                yield session

            previous = app.dependency_overrides.copy()
            app.dependency_overrides[get_db] = override_get_db
            try:
                with TestClient(app) as client:
                    yield client, session
            finally:
                app.dependency_overrides.clear()
                app.dependency_overrides.update(previous)
                session.close()
                transaction.rollback()


def make_user(session: Session, name: str | None = None) -> User:
    name = name or f"u_{uuid4().hex[:12]}"
    user = User(
        username=name,
        email=f"{name}@example.com",
        password_hash=hash_password("ExamplePass123!"),
    )
    session.add(user)
    session.flush()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def game_payload(**overrides) -> dict:
    start = now() + 2 * HOUR
    payload = {
        "title": "Basketball at Central Park",
        "game_name": "Basketball",
        "start_time": start.isoformat(),
        "end_time": (start + 2 * HOUR).isoformat(),
        "location": "Central Park, New York",
        "skill_level": "beginner",
        "capacity": 10,
    }
    payload.update(overrides)
    return payload


def create_game(client, user, **overrides) -> int:
    response = client.post("/api/games", json=game_payload(**overrides), headers=auth(user))
    assert response.status_code == 201, response.text
    return response.json()["game_id"]


def insert_game(session: Session, organizer: User, **overrides) -> Game:
    """Insert straight into the DB (bypasses API validation, e.g. for ended games)."""
    start = overrides.pop("start_time", now() + 2 * HOUR)
    fields = dict(
        organizer_id=organizer.id,
        title="Game",
        game_name="Basketball",
        start_time=start,
        end_time=overrides.pop("end_time", start + 2 * HOUR),
        location="Somewhere",
        skill_level="beginner",
        language="English",
        capacity=10,
    )
    fields.update(overrides)
    game = Game(**fields)
    game.participants.append(GameParticipant(user_id=organizer.id))
    session.add(game)
    session.flush()
    return game


def reason(response) -> str:
    return response.json()["detail"]["reason"]


# --------------------------------------------------------------------------
# Authentication
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/games"),
        ("post", "/api/games"),
        ("get", "/api/games/1"),
        ("patch", "/api/games/1"),
        ("delete", "/api/games/1"),
        ("post", "/api/games/1/join"),
        ("delete", "/api/games/1/participants/me"),
        ("get", "/api/games/1/players"),
    ],
)
def test_endpoints_require_authentication(ctx, method, path):
    client, _ = ctx
    assert getattr(client, method)(path).status_code == 401


# --------------------------------------------------------------------------
# Create
# --------------------------------------------------------------------------


def test_create_game_adds_organizer_to_roster(ctx):
    client, session = ctx
    alex = make_user(session, "alex")

    response = client.post("/api/games", json=game_payload(), headers=auth(alex))

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert isinstance(body["game_id"], int)

    detail = client.get(f"/api/games/{body['game_id']}", headers=auth(alex)).json()
    assert detail["organizer_id"] == str(alex.id)
    assert detail["players_joined"] == 1
    assert detail["spots_left"] == 9
    assert detail["status"] == "upcoming"
    assert [p["username"] for p in detail["participants"]] == ["alex"]


def test_create_game_optional_fields(ctx):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(
        client,
        alex,
        description="Casual",
        equipment_notes="Bring water",
        tags=["outdoor", " Outdoor ", "free"],
        language="Spanish",
        latitude=40.78,
        longitude=-73.96,
    )
    detail = client.get(f"/api/games/{game_id}", headers=auth(alex)).json()
    assert detail["description"] == "Casual"
    assert detail["equipment_notes"] == "Bring water"
    assert detail["tags"] == ["outdoor", "free"]  # trimmed, de-duplicated
    assert detail["language"] == "Spanish"
    assert detail["latitude"] == 40.78


def test_create_game_starts_active_when_already_started(ctx):
    client, session = ctx
    alex = make_user(session)
    start = now() - 30 * timedelta(minutes=1)
    game_id = create_game(
        client,
        alex,
        start_time=start.isoformat(),
        end_time=(start + 2 * HOUR).isoformat(),
    )
    assert client.get(f"/api/games/{game_id}", headers=auth(alex)).json()["status"] == "active"


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": ""},
        {"title": "   "},
        {"game_name": ""},
        {"location": ""},
        {"skill_level": "expert"},
        {"capacity": 0},
        {"capacity": -3},
        {"capacity": "ten"},
        {"unknown_field": 1},
        {"latitude": 10.0},  # longitude missing
        {"latitude": 95.0, "longitude": 0},
        {"tags": ["x" * 31]},
    ],
)
def test_create_game_rejects_invalid_input(ctx, overrides):
    client, session = ctx
    alex = make_user(session)
    response = client.post("/api/games", json=game_payload(**overrides), headers=auth(alex))
    assert response.status_code == 422


def test_create_game_rejects_bad_times(ctx):
    client, session = ctx
    alex = make_user(session)
    start = now() + 2 * HOUR

    def post(start_time, end_time):
        return client.post(
            "/api/games",
            json=game_payload(
                start_time=start_time.isoformat(), end_time=end_time.isoformat()
            ),
            headers=auth(alex),
        )

    assert post(start, start).status_code == 422  # zero length
    assert post(start, start - HOUR).status_code == 422  # ends before it starts
    assert post(start, start + 6 * HOUR + timedelta(seconds=1)).status_code == 422  # > 6h
    assert post(now() - 3 * HOUR, now() - HOUR).status_code == 422  # already ended
    # Exactly six hours is allowed.
    assert post(start, start + 6 * HOUR).status_code == 201
    # Naive timestamps (no timezone) are rejected.
    naive = (start.replace(tzinfo=None)).isoformat()
    naive_end = ((start + HOUR).replace(tzinfo=None)).isoformat()
    response = client.post(
        "/api/games",
        json=game_payload(start_time=naive, end_time=naive_end),
        headers=auth(alex),
    )
    assert response.status_code == 422


def test_create_game_accepts_plan_example_payload(ctx):
    """The exact message from plan B.3 (with a future date)."""
    client, session = ctx
    alex = make_user(session)
    start = (now() + 3 * HOUR).astimezone(timezone(timedelta(hours=-5)))
    payload = {
        "title": "Basketball at Central Park",
        "game_name": "Basketball",
        "start_time": start.isoformat(),
        "end_time": (start + 2 * HOUR).isoformat(),
        "location": "Central Park",
        "skill_level": "beginner",
        "capacity": 10,
    }
    assert client.post("/api/games", json=payload, headers=auth(alex)).status_code == 201


# --------------------------------------------------------------------------
# Read
# --------------------------------------------------------------------------


def test_get_game_not_found(ctx):
    client, session = ctx
    alex = make_user(session)
    response = client.get("/api/games/99999999", headers=auth(alex))
    assert response.status_code == 404
    assert reason(response) == "gameNotFound"


def test_get_ended_game_is_terminated(ctx):
    client, session = ctx
    alex = make_user(session)
    game = insert_game(session, alex, start_time=now() - 3 * HOUR, end_time=now() - HOUR)
    response = client.get(f"/api/games/{game.id}", headers=auth(alex))
    assert response.status_code == 410
    assert reason(response) == "gameTerminated"


def test_game_detail_follows_plan_contract(ctx):
    client, session = ctx
    alex, jordan = make_user(session, "alex"), make_user(session, "jordan")
    game_id = create_game(client, alex, capacity=10)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))

    detail = client.get(f"/api/games/{game_id}", headers=auth(jordan)).json()
    for key in (
        "game_id", "title", "game_name", "organizer_id", "start_time", "end_time",
        "location", "skill_level", "language", "capacity", "players_joined",
        "status", "description", "equipment_notes", "participants",
    ):
        assert key in detail, key
    assert detail["players_joined"] == 2
    assert {p["username"] for p in detail["participants"]} == {"alex", "jordan"}
    assert "email" not in detail["participants"][0]


# --------------------------------------------------------------------------
# Edit
# --------------------------------------------------------------------------


def test_organizer_can_edit_game(ctx):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(client, alex, latitude=40.0, longitude=-73.0)
    new_start = now() + 5 * HOUR

    response = client.patch(
        f"/api/games/{game_id}",
        json={
            "title": "Moved game",
            "start_time": new_start.isoformat(),
            "end_time": (new_start + HOUR).isoformat(),
            "skill_level": "advanced",
            "capacity": 12,
        },
        headers=auth(alex),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Moved game"
    assert body["skill_level"] == "advanced"
    assert body["capacity"] == 12
    assert body["game_name"] == "Basketball"  # untouched
    assert body["latitude"] == 40.0  # untouched when location unchanged


def test_changing_location_clears_stale_coordinates(ctx):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(client, alex, latitude=40.0, longitude=-73.0)

    body = client.patch(
        f"/api/games/{game_id}", json={"location": "Brooklyn"}, headers=auth(alex)
    ).json()
    assert body["location"] == "Brooklyn"
    assert body["latitude"] is None and body["longitude"] is None

    body = client.patch(
        f"/api/games/{game_id}",
        json={"location": "Queens", "latitude": 40.7, "longitude": -73.8},
        headers=auth(alex),
    ).json()
    assert body["latitude"] == 40.7


def test_non_organizer_cannot_edit_or_delete(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game_id = create_game(client, alex)

    response = client.patch(f"/api/games/{game_id}", json={"title": "Hijack"}, headers=auth(jordan))
    assert response.status_code == 403 and reason(response) == "notOrganizer"
    response = client.delete(f"/api/games/{game_id}", headers=auth(jordan))
    assert response.status_code == 403 and reason(response) == "notOrganizer"

    assert client.get(f"/api/games/{game_id}", headers=auth(alex)).json()["title"] != "Hijack"


@pytest.mark.parametrize(
    "changes",
    [
        {"title": None},
        {"capacity": 0},
        {"skill_level": "pro"},
        {"end_time": (now() - HOUR).isoformat()},
        {"latitude": 1.0},
        {"owner": "x"},
        {"tags": None},  # was a 500 (NOT NULL violation)
        {"language": None},
        {"is_online": None},
    ],
)
def test_edit_rejects_invalid_changes(ctx, changes):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(client, alex)
    response = client.patch(f"/api/games/{game_id}", json=changes, headers=auth(alex))
    assert response.status_code == 422


def test_edit_cannot_exceed_six_hours_or_invert_times(ctx):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(client, alex)
    detail = client.get(f"/api/games/{game_id}", headers=auth(alex)).json()
    start = datetime.fromisoformat(detail["start_time"])

    r = client.patch(
        f"/api/games/{game_id}",
        json={"end_time": (start + 7 * HOUR).isoformat()},
        headers=auth(alex),
    )
    assert r.status_code == 422 and reason(r) == "invalidGameDetails"
    r = client.patch(
        f"/api/games/{game_id}",
        json={"end_time": (start - HOUR).isoformat()},
        headers=auth(alex),
    )
    assert r.status_code == 422 and reason(r) == "invalidGameDetails"


def test_edit_cannot_shrink_capacity_below_joined_players(ctx):
    client, session = ctx
    alex, jordan, taylor = (make_user(session) for _ in range(3))
    game_id = create_game(client, alex, capacity=5)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    client.post(f"/api/games/{game_id}/join", headers=auth(taylor))

    r = client.patch(f"/api/games/{game_id}", json={"capacity": 2}, headers=auth(alex))
    assert r.status_code == 422 and reason(r) == "invalidGameDetails"
    r = client.patch(f"/api/games/{game_id}", json={"capacity": 3}, headers=auth(alex))
    assert r.status_code == 200


def test_cannot_edit_ended_game(ctx):
    client, session = ctx
    alex = make_user(session)
    game = insert_game(session, alex, start_time=now() - 3 * HOUR, end_time=now() - HOUR)
    r = client.patch(f"/api/games/{game.id}", json={"title": "x"}, headers=auth(alex))
    assert r.status_code == 410 and reason(r) == "gameTerminated"


# --------------------------------------------------------------------------
# Delete
# --------------------------------------------------------------------------


def test_organizer_delete_removes_game_and_roster(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game_id = create_game(client, alex)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))

    response = client.delete(f"/api/games/{game_id}", headers=auth(alex))
    assert response.status_code == 200
    assert response.json()["game_id"] == game_id

    assert client.get(f"/api/games/{game_id}", headers=auth(alex)).status_code == 404
    session.expire_all()
    leftover = session.scalar(
        select(func.count()).select_from(GameParticipant).where(GameParticipant.game_id == game_id)
    )
    assert leftover == 0


# --------------------------------------------------------------------------
# Join / leave / roster
# --------------------------------------------------------------------------


def test_join_and_leave(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session, "jordan")
    game_id = create_game(client, alex)

    r = client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    assert r.status_code == 200
    assert r.json() == {
        "status": "success",
        "message": "Joined game successfully",
        "game_id": game_id,
        "players_joined": 2,
    }

    players = client.get(f"/api/games/{game_id}/players", headers=auth(alex)).json()
    assert players["players_joined"] == 2
    assert {p["username"] for p in players["players"]} >= {"jordan"}

    r = client.delete(f"/api/games/{game_id}/participants/me", headers=auth(jordan))
    assert r.status_code == 200 and r.json()["players_joined"] == 1


def test_join_twice_rejected(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game_id = create_game(client, alex)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    r = client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    assert r.status_code == 409 and reason(r) == "alreadyJoined"
    # The organizer is already on the roster too.
    r = client.post(f"/api/games/{game_id}/join", headers=auth(alex))
    assert r.status_code == 409 and reason(r) == "alreadyJoined"


def test_join_full_game_rejected(ctx):
    client, session = ctx
    alex, jordan, taylor = (make_user(session) for _ in range(3))
    game_id = create_game(client, alex, capacity=2)
    assert client.post(f"/api/games/{game_id}/join", headers=auth(jordan)).status_code == 200

    r = client.post(f"/api/games/{game_id}/join", headers=auth(taylor))
    assert r.status_code == 409 and reason(r) == "gameFull"
    assert client.get(f"/api/games/{game_id}", headers=auth(alex)).json()["players_joined"] == 2


def test_capacity_one_game_is_full_immediately(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game_id = create_game(client, alex, capacity=1)
    r = client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    assert r.status_code == 409 and reason(r) == "gameFull"


def test_join_ended_or_missing_game_rejected(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game = insert_game(session, alex, start_time=now() - 3 * HOUR, end_time=now() - HOUR)
    r = client.post(f"/api/games/{game.id}/join", headers=auth(jordan))
    assert r.status_code == 410 and reason(r) == "gameTerminated"
    r = client.post("/api/games/99999999/join", headers=auth(jordan))
    assert r.status_code == 404 and reason(r) == "gameNotFound"


def test_leave_requires_being_joined(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    game_id = create_game(client, alex)
    r = client.delete(f"/api/games/{game_id}/participants/me", headers=auth(jordan))
    assert r.status_code == 409 and reason(r) == "notJoined"


def test_organizer_cannot_leave_own_game(ctx):
    client, session = ctx
    alex = make_user(session)
    game_id = create_game(client, alex)
    r = client.delete(f"/api/games/{game_id}/participants/me", headers=auth(alex))
    assert r.status_code == 409 and reason(r) == "organizerCannotLeave"


def test_leaving_frees_a_spot(ctx):
    client, session = ctx
    alex, jordan, taylor = (make_user(session) for _ in range(3))
    game_id = create_game(client, alex, capacity=2)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))
    assert client.post(f"/api/games/{game_id}/join", headers=auth(taylor)).status_code == 409
    client.delete(f"/api/games/{game_id}/participants/me", headers=auth(jordan))
    assert client.post(f"/api/games/{game_id}/join", headers=auth(taylor)).status_code == 200


def test_organizer_can_remove_player(ctx):
    client, session = ctx
    alex, jordan, taylor = (make_user(session) for _ in range(3))
    game_id = create_game(client, alex)
    client.post(f"/api/games/{game_id}/join", headers=auth(jordan))

    # Another player cannot remove someone.
    r = client.delete(f"/api/games/{game_id}/participants/{jordan.id}", headers=auth(taylor))
    assert r.status_code == 403 and reason(r) == "notOrganizer"
    # The organizer cannot be removed.
    r = client.delete(f"/api/games/{game_id}/participants/{alex.id}", headers=auth(alex))
    assert r.status_code == 409
    # Removing someone who is not on the roster.
    r = client.delete(f"/api/games/{game_id}/participants/{taylor.id}", headers=auth(alex))
    assert r.status_code == 409 and reason(r) == "notJoined"

    r = client.delete(f"/api/games/{game_id}/participants/{jordan.id}", headers=auth(alex))
    assert r.status_code == 200 and r.json()["players_joined"] == 1


# --------------------------------------------------------------------------
# Listing, filters, sorting
# --------------------------------------------------------------------------


def ids(response) -> list[int]:
    assert response.status_code == 200, response.text
    return [g["game_id"] for g in response.json()["items"]]


def test_list_excludes_ended_games_and_deletes_them(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    live = insert_game(session, alex, language=lang)
    ended = insert_game(session, alex, language=lang, start_time=now() - 3 * HOUR, end_time=now() - HOUR)
    ended_id = ended.id

    result = ids(client.get("/api/games", params={"language": lang}, headers=auth(alex)))
    assert live.id in result and ended_id not in result

    session.expire_all()
    assert session.get(Game, ended_id) is None  # purged, roster included
    assert (
        session.scalar(
            select(func.count()).select_from(GameParticipant).where(GameParticipant.game_id == ended_id)
        )
        == 0
    )


def test_list_includes_games_in_progress(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    started = insert_game(session, alex, language=lang, start_time=now() - HOUR, end_time=now() + HOUR)
    body = client.get("/api/games", params={"language": lang}, headers=auth(alex)).json()
    item = next(g for g in body["items"] if g["game_id"] == started.id)
    assert item["status"] == "active"


def test_default_sort_is_soonest_first(ctx):
    client, session = ctx
    alex = make_user(session)
    # Isolate this test's games with a unique game_name filter.
    name = f"Sport{uuid4().hex[:8]}"
    late = insert_game(session, alex, game_name=name, start_time=now() + 8 * HOUR)
    soon = insert_game(session, alex, game_name=name, start_time=now() + 3 * HOUR)
    mid = insert_game(session, alex, game_name=name, start_time=now() + 5 * HOUR)
    r = client.get("/api/games", params={"game_name": name}, headers=auth(alex))
    assert ids(r) == [soon.id, mid.id, late.id]


def test_sort_by_game_name_then_start_time(ctx):
    client, session = ctx
    alex = make_user(session)
    tag = uuid4().hex[:6]
    lang = f"Lang{tag}"
    b_late = insert_game(session, alex, game_name="bravo", language=lang, start_time=now() + 9 * HOUR)
    a = insert_game(session, alex, game_name="Alpha", language=lang, start_time=now() + 7 * HOUR)
    b_soon = insert_game(session, alex, game_name="Bravo", language=lang, start_time=now() + 3 * HOUR)
    r = client.get("/api/games", params={"language": lang, "sort": "game_name"}, headers=auth(alex))
    # A-Z (case-insensitive); ties on name resolved by start time.
    assert ids(r) == [a.id, b_soon.id, b_late.id]


def test_sort_by_skill_level_lowest_first_then_start_time(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    adv = insert_game(session, alex, skill_level="advanced", language=lang, start_time=now() + 3 * HOUR)
    beg_late = insert_game(session, alex, skill_level="beginner", language=lang, start_time=now() + 9 * HOUR)
    inter = insert_game(session, alex, skill_level="intermediate", language=lang, start_time=now() + 4 * HOUR)
    beg_soon = insert_game(session, alex, skill_level="beginner", language=lang, start_time=now() + 5 * HOUR)
    r = client.get("/api/games", params={"language": lang, "sort": "skill_level"}, headers=auth(alex))
    assert ids(r) == [beg_soon.id, beg_late.id, inter.id, adv.id]


def test_filters_each_alone_and_combined(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    other_lang = f"Other{uuid4().hex[:6]}"
    a = insert_game(session, alex, game_name="Soccer", skill_level="beginner", language=lang, location="Boston Common")
    b = insert_game(session, alex, game_name="Soccer", skill_level="advanced", language=lang, location="Cambridge")
    c = insert_game(session, alex, game_name="Tennis", skill_level="beginner", language=lang, location="Boston Garden")
    d = insert_game(session, alex, game_name="Soccer", skill_level="beginner", language=other_lang, location="Boston")
    h = auth(alex)

    def get(**params):
        return set(ids(client.get("/api/games", params=params, headers=h)))

    assert get(language=lang) == {a.id, b.id, c.id}
    assert get(language=lang, game_name="soccer") == {a.id, b.id}  # case-insensitive
    assert get(language=lang, skill_level="beginner") == {a.id, c.id}
    assert get(language=lang, q="boston") == {a.id, c.id}
    # Combined: every selected filter must match.
    assert get(language=lang, game_name="Soccer", skill_level="beginner", q="Boston") == {a.id}
    # Multi-select within one filter is OR.
    assert get(language=lang, skill_level=["beginner", "advanced"]) == {a.id, b.id, c.id}
    assert get(language=lang, game_name=["Soccer", "Tennis"]) == {a.id, b.id, c.id}
    # Language is separate from other languages.
    assert get(language=other_lang) == {d.id}
    # No match -> empty list, not an error.
    assert get(language=lang, game_name="Curling") == set()


def test_text_filter_treats_wildcards_literally(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    insert_game(session, alex, language=lang, location="Plain Street")
    pct = insert_game(session, alex, language=lang, location="100% Fun Field")
    r = client.get("/api/games", params={"language": lang, "q": "%"}, headers=auth(alex))
    assert ids(r) == [pct.id]


def test_invalid_filter_values_rejected(ctx):
    client, session = ctx
    alex = make_user(session)
    h = auth(alex)
    assert client.get("/api/games", params={"skill_level": "expert"}, headers=h).status_code == 422
    assert client.get("/api/games", params={"sort": "price"}, headers=h).status_code == 422
    assert client.get("/api/games", params={"limit": 0}, headers=h).status_code == 422
    assert client.get("/api/games", params={"lat": 10}, headers=h).status_code == 422  # needs lng+radius


def test_distance_filter(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    # Central Park, Times Square (~2.5 km), Boston (~300 km), and one without coordinates.
    park = insert_game(session, alex, language=lang, latitude=40.7829, longitude=-73.9654)
    square = insert_game(session, alex, language=lang, latitude=40.7580, longitude=-73.9855)
    boston = insert_game(session, alex, language=lang, latitude=42.3601, longitude=-71.0589)
    nocoords = insert_game(session, alex, language=lang)
    h = auth(alex)

    def near(radius):
        r = client.get(
            "/api/games",
            params={"language": lang, "lat": 40.7829, "lng": -73.9654, "radius_km": radius},
            headers=h,
        )
        return ids(r), r.json()["items"]

    near_ids, items = near(5)
    assert set(near_ids) == {park.id, square.id}
    distances = {g["game_id"]: g["distance_km"] for g in items}
    assert distances[park.id] < 0.1
    assert 2.0 < distances[square.id] < 3.5
    assert set(near(500)[0]) == {park.id, square.id, boston.id}
    assert nocoords.id not in near(20000)[0]
    # Without a geo filter, games without coordinates still show up.
    assert nocoords.id in ids(client.get("/api/games", params={"language": lang}, headers=h))


def test_online_games_filter(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    online = insert_game(session, alex, language=lang, is_online=True)
    inperson = insert_game(session, alex, language=lang)
    h = auth(alex)
    assert ids(client.get("/api/games", params={"language": lang, "is_online": False}, headers=h)) == [inperson.id]
    assert ids(client.get("/api/games", params={"language": lang, "is_online": True}, headers=h)) == [online.id]


def test_has_spots_and_joined_filters(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    full = insert_game(session, alex, language=lang, capacity=1)
    open_ = insert_game(session, alex, language=lang, capacity=5)
    h = auth(jordan)

    assert set(ids(client.get("/api/games", params={"language": lang}, headers=h))) == {full.id, open_.id}
    assert ids(client.get("/api/games", params={"language": lang, "has_spots": True}, headers=h)) == [open_.id]

    client.post(f"/api/games/{open_.id}/join", headers=h)
    assert ids(client.get("/api/games", params={"language": lang, "joined": True}, headers=h)) == [open_.id]


def test_pagination_and_total(ctx):
    client, session = ctx
    alex = make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    games = [insert_game(session, alex, language=lang, start_time=now() + (i + 2) * HOUR) for i in range(5)]
    h = auth(alex)

    page1 = client.get("/api/games", params={"language": lang, "limit": 2}, headers=h).json()
    page2 = client.get("/api/games", params={"language": lang, "limit": 2, "offset": 2}, headers=h).json()
    page3 = client.get("/api/games", params={"language": lang, "limit": 2, "offset": 4}, headers=h).json()
    assert page1["total"] == page2["total"] == 5
    assert [g["game_id"] for g in page1["items"] + page2["items"] + page3["items"]] == [g.id for g in games]


def test_list_reports_player_counts(ctx):
    client, session = ctx
    alex, jordan = make_user(session), make_user(session)
    lang = f"Lang{uuid4().hex[:6]}"
    game = insert_game(session, alex, language=lang, capacity=3)
    client.post(f"/api/games/{game.id}/join", headers=auth(jordan))
    item = client.get("/api/games", params={"language": lang}, headers=auth(alex)).json()["items"][0]
    assert item["players_joined"] == 2 and item["spots_left"] == 1 and item["capacity"] == 3
    assert "participants" not in item  # the list stays compact


# --------------------------------------------------------------------------
# Concurrency: two people take the last spot at the same time (S6.3, NFR6)
# --------------------------------------------------------------------------


def test_last_spot_goes_to_exactly_one_player(monkeypatch):
    # Make the capacity check slow so every request is "in the middle" of
    # joining at once. Without the row lock this overbooks the game.
    real_count = games_router.count_players

    def slow_count(db, game_id):
        value = real_count(db, game_id)
        time.sleep(0.3)
        return value

    monkeypatch.setattr(games_router, "count_players", slow_count)

    with SessionLocal() as setup:
        organizer = make_user(setup)
        racers = [make_user(setup) for _ in range(6)]
        game = insert_game(setup, organizer, capacity=2)  # organizer + exactly 1 free spot
        setup.commit()
        game_id = game.id
        user_ids = [organizer.id] + [r.id for r in racers]
        headers = [auth(r) for r in racers]

    def attempt(h):
        with TestClient(app) as client:
            return client.post(f"/api/games/{game_id}/join", headers=h).status_code

    try:
        with ThreadPoolExecutor(max_workers=len(headers)) as pool:
            codes = list(pool.map(attempt, headers))

        assert sorted(codes) == [200] + [409] * (len(headers) - 1), codes
        with SessionLocal() as check:
            assert (
                check.scalar(
                    select(func.count()).select_from(GameParticipant).where(GameParticipant.game_id == game_id)
                )
                == 2
            )
    finally:
        with SessionLocal() as cleanup:
            cleanup.execute(delete(Game).where(Game.id == game_id))
            cleanup.execute(delete(User).where(User.id.in_(user_ids)))
            cleanup.commit()
