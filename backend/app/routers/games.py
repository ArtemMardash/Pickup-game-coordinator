"""Game posts, lobbies, discovery filters (plan milestones 1, 3 and 4).

Error responses use the plan's rejection reasons (Appendix B.3):
``{"detail": {"status": "error", "reason": "gameFull", "message": "..."}}``.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, case, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser
from app.models.game import (
    MAX_GAME_HOURS,
    SKILL_LEVEL_ORDER,
    Game,
    GameParticipant,
    SkillLevel,
)
from app.schemas.game import (
    MAX_DURATION,
    GameCreate,
    GameCreated,
    GameDeleted,
    GameList,
    GameRead,
    GameSummary,
    GameUpdate,
    JoinResult,
    ParticipantRead,
    PlayerList,
)

router = APIRouter(prefix="/api/games", tags=["Games"])

DatabaseSession = Annotated[Session, Depends(get_db)]

EARTH_RADIUS_KM = 6371.0


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def api_error(code: int, reason: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=code,
        detail={"status": "error", "reason": reason, "message": message},
    )


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def player_count_expr():
    return (
        select(func.count())
        .select_from(GameParticipant)
        .where(GameParticipant.game_id == Game.id)
        .correlate(Game)
        .scalar_subquery()
    )


def game_status(game: Game, now: datetime) -> Literal["upcoming", "active"]:
    return "active" if game.start_time <= now else "upcoming"


def get_game_or_error(
    db: Session, game_id: int, *, lock: bool = False
) -> Game:
    """Load a game that has not ended yet.

    ``lock=True`` takes a row lock (SELECT ... FOR UPDATE) so capacity checks
    and roster changes for this game are serialised (plan S6.3, NFR6).
    """
    stmt = select(Game).where(Game.id == game_id)
    if lock:
        stmt = stmt.with_for_update(of=Game).execution_options(
            populate_existing=True
        )
    game = db.execute(stmt).unique().scalar_one_or_none()

    if game is None:
        raise api_error(404, "gameNotFound", "Game not found")
    if game.end_time <= utcnow():
        raise api_error(410, "gameTerminated", "This game has already ended")
    return game


def count_players(db: Session, game_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(GameParticipant)
        .where(GameParticipant.game_id == game_id)
    ) or 0


def to_read(game: Game) -> GameRead:
    now = utcnow()
    joined = len(game.participants)
    return GameRead(
        game_id=game.id,
        title=game.title,
        game_name=game.game_name,
        organizer_id=game.organizer_id,
        organizer_username=game.organizer.username,
        start_time=game.start_time,
        end_time=game.end_time,
        location=game.location,
        latitude=game.latitude,
        longitude=game.longitude,
        is_online=game.is_online,
        skill_level=SkillLevel(game.skill_level),
        language=game.language,
        capacity=game.capacity,
        players_joined=joined,
        spots_left=max(game.capacity - joined, 0),
        status=game_status(game, now),
        description=game.description,
        equipment_notes=game.equipment_notes,
        tags=list(game.tags or []),
        participants=[
            ParticipantRead(user_id=p.user_id, username=p.user.username)
            for p in game.participants
        ],
    )


def purge_ended_games(db: Session) -> None:
    """Delete ended games; their rosters go with them (plan S4.2, NFR3)."""
    db.execute(delete(Game).where(Game.end_time <= utcnow()))
    db.commit()


# --------------------------------------------------------------------------
# Discovery: list / map (F7-F11)
# --------------------------------------------------------------------------


@router.get("", response_model=GameList)
def list_games(
    current_user: CurrentUser,
    db: DatabaseSession,
    game_name: Annotated[list[str] | None, Query()] = None,
    skill_level: Annotated[list[SkillLevel] | None, Query()] = None,
    language: Annotated[list[str] | None, Query()] = None,
    q: Annotated[
        str | None,
        Query(max_length=255, description="Text search on the location"),
    ] = None,
    lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float | None, Query(gt=0, le=20000)] = None,
    is_online: bool | None = None,
    joined: Annotated[
        bool, Query(description="Only games I am on the roster of")
    ] = False,
    has_spots: Annotated[
        bool, Query(description="Hide games that are full")
    ] = False,
    sort: Literal["start_time", "game_name", "skill_level"] = "start_time",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> GameList:
    """Upcoming and active games. Every selected filter must match.

    Ended games are never returned. Ties are broken by start time, then id,
    so the order is stable between the list and the map.
    """
    geo_params = (lat, lng, radius_km)
    if any(p is not None for p in geo_params) and not all(
        p is not None for p in geo_params
    ):
        raise api_error(
            422,
            "invalidFilter",
            "lat, lng and radius_km must be provided together",
        )

    purge_ended_games(db)
    now = utcnow()
    players = player_count_expr()

    distance = None
    if lat is not None and lng is not None:
        cos_angle = func.cos(func.radians(lat)) * func.cos(
            func.radians(Game.latitude)
        ) * func.cos(func.radians(Game.longitude) - func.radians(lng)) + (
            func.sin(func.radians(lat)) * func.sin(func.radians(Game.latitude))
        )
        distance = (
            EARTH_RADIUS_KM
            * func.acos(func.least(1.0, func.greatest(-1.0, cos_angle)))
        ).label("distance_km")

    stmt: Select = select(Game, players.label("players_joined"))
    if distance is not None:
        stmt = stmt.add_columns(distance)
    stmt = stmt.where(Game.end_time > now)

    if game_name:
        stmt = stmt.where(
            func.lower(Game.game_name).in_([g.strip().lower() for g in game_name])
        )
    if skill_level:
        stmt = stmt.where(Game.skill_level.in_([s.value for s in skill_level]))
    if language:
        stmt = stmt.where(
            func.lower(Game.language).in_([x.strip().lower() for x in language])
        )
    if q:
        escaped = q.strip().replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        stmt = stmt.where(Game.location.ilike(f"%{escaped}%", escape="\\"))
    if is_online is not None:
        stmt = stmt.where(Game.is_online.is_(is_online))
    if joined:
        stmt = stmt.where(
            Game.id.in_(
                select(GameParticipant.game_id).where(
                    GameParticipant.user_id == current_user.id
                )
            )
        )
    if has_spots:
        stmt = stmt.where(players < Game.capacity)
    if distance is not None:
        # Games without coordinates can never match an area filter.
        stmt = stmt.where(
            Game.latitude.is_not(None),
            Game.longitude.is_not(None),
            Game.is_online.is_(False),
            distance <= radius_km,
        )

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    if sort == "game_name":
        primary = func.lower(Game.game_name)
    elif sort == "skill_level":
        primary = case(
            {level: i for i, level in enumerate(SKILL_LEVEL_ORDER)},
            value=Game.skill_level,
            else_=len(SKILL_LEVEL_ORDER),
        )
    else:
        primary = Game.start_time
    order = [primary]
    if sort != "start_time":
        order.append(Game.start_time)
    order.append(Game.id)

    rows = db.execute(stmt.order_by(*order).limit(limit).offset(offset)).unique().all()

    items = []
    for row in rows:
        game, joined_count = row[0], row[1]
        items.append(
            GameSummary(
                game_id=game.id,
                title=game.title,
                game_name=game.game_name,
                organizer_id=game.organizer_id,
                organizer_username=game.organizer.username,
                start_time=game.start_time,
                end_time=game.end_time,
                location=game.location,
                latitude=game.latitude,
                longitude=game.longitude,
                is_online=game.is_online,
                skill_level=SkillLevel(game.skill_level),
                language=game.language,
                capacity=game.capacity,
                players_joined=joined_count,
                spots_left=max(game.capacity - joined_count, 0),
                status=game_status(game, now),
                tags=list(game.tags or []),
                distance_km=round(row[2], 2) if distance is not None else None,
            )
        )

    return GameList(total=total, limit=limit, offset=offset, items=items)


# --------------------------------------------------------------------------
# Create / read / edit / delete
# --------------------------------------------------------------------------


@router.post("", response_model=GameCreated, status_code=status.HTTP_201_CREATED)
def create_game(
    payload: GameCreate, current_user: CurrentUser, db: DatabaseSession
) -> GameCreated:
    game = Game(
        organizer_id=current_user.id,
        title=payload.title,
        game_name=payload.game_name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_online=payload.is_online,
        skill_level=payload.skill_level.value,
        language=payload.language,
        capacity=payload.capacity,
        description=payload.description,
        equipment_notes=payload.equipment_notes,
        tags=payload.tags,
    )
    # The organizer is added to the player list automatically (S5).
    game.participants.append(GameParticipant(user_id=current_user.id))
    db.add(game)
    db.commit()
    return GameCreated(game_id=game.id)


@router.get("/{game_id}", response_model=GameRead)
def get_game(game_id: int, current_user: CurrentUser, db: DatabaseSession) -> GameRead:
    return to_read(get_game_or_error(db, game_id))


@router.patch("/{game_id}", response_model=GameRead)
def update_game(
    game_id: int,
    payload: GameUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> GameRead:
    game = get_game_or_error(db, game_id, lock=True)

    if game.organizer_id != current_user.id:
        raise api_error(403, "notOrganizer", "Only the organizer can edit this game")

    changes = payload.model_dump(exclude_unset=True)

    if "skill_level" in changes:
        changes["skill_level"] = changes["skill_level"].value

    # A new address invalidates the stored coordinates unless new ones come with it.
    if "location" in changes and "latitude" not in changes and "longitude" not in changes:
        changes["latitude"] = None
        changes["longitude"] = None
    if ("latitude" in changes) != ("longitude" in changes) or (
        (changes.get("latitude") is None) != (changes.get("longitude") is None)
    ):
        raise api_error(
            422, "invalidGameDetails", "latitude and longitude must be provided together"
        )

    start = changes.get("start_time", game.start_time)
    end = changes.get("end_time", game.end_time)
    capacity = changes.get("capacity", game.capacity)
    joined = count_players(db, game.id)

    problem = None
    if end <= start:
        problem = "end_time must be after start_time"
    elif end - start > MAX_DURATION:
        problem = f"A game cannot last longer than {MAX_GAME_HOURS} hours"
    elif end <= utcnow():
        problem = "end_time must be in the future"
    elif capacity < joined:
        problem = f"capacity cannot be lower than the {joined} players already joined"
    if problem:
        raise api_error(422, "invalidGameDetails", problem)

    for field, value in changes.items():
        setattr(game, field, value)

    db.commit()
    db.refresh(game)
    return to_read(game)


@router.delete("/{game_id}", response_model=GameDeleted)
def delete_game(
    game_id: int, current_user: CurrentUser, db: DatabaseSession
) -> GameDeleted:
    """Cancel / end a game. The post and its player list are removed (S1.2, S4.1)."""
    game = get_game_or_error(db, game_id, lock=True)

    if game.organizer_id != current_user.id:
        raise api_error(403, "notOrganizer", "Only the organizer can delete this game")

    db.delete(game)
    db.commit()
    return GameDeleted(game_id=game_id)


# --------------------------------------------------------------------------
# Lobby: join / leave / roster
# --------------------------------------------------------------------------


@router.post("/{game_id}/join", response_model=JoinResult)
def join_game(game_id: int, current_user: CurrentUser, db: DatabaseSession) -> JoinResult:
    # The row lock serialises concurrent joins: with one spot left, exactly
    # one request gets in and the other sees "gameFull".
    game = get_game_or_error(db, game_id, lock=True)

    already = db.get(GameParticipant, (game.id, current_user.id))
    if already is not None:
        raise api_error(409, "alreadyJoined", "You have already joined this game")

    joined = count_players(db, game.id)
    if joined >= game.capacity:
        raise api_error(409, "gameFull", "This game is full")

    db.add(GameParticipant(game_id=game.id, user_id=current_user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "alreadyJoined", "You have already joined this game")

    return JoinResult(
        message="Joined game successfully",
        game_id=game.id,
        players_joined=joined + 1,
    )


@router.delete("/{game_id}/participants/me", response_model=JoinResult)
def leave_game(game_id: int, current_user: CurrentUser, db: DatabaseSession) -> JoinResult:
    game = get_game_or_error(db, game_id, lock=True)

    if game.organizer_id == current_user.id:
        raise api_error(
            409,
            "organizerCannotLeave",
            "The organizer cannot leave; delete the game to end it",
        )

    participant = db.get(GameParticipant, (game.id, current_user.id))
    if participant is None:
        raise api_error(409, "notJoined", "You have not joined this game")

    db.delete(participant)
    db.commit()
    return JoinResult(
        message="Left game successfully",
        game_id=game.id,
        players_joined=count_players(db, game.id),
    )


@router.delete("/{game_id}/participants/{user_id}", response_model=JoinResult)
def remove_player(
    game_id: int, user_id: UUID, current_user: CurrentUser, db: DatabaseSession
) -> JoinResult:
    """Organizer removes another player from the roster."""
    game = get_game_or_error(db, game_id, lock=True)

    if game.organizer_id != current_user.id:
        raise api_error(403, "notOrganizer", "Only the organizer can remove players")
    if user_id == game.organizer_id:
        raise api_error(
            409,
            "organizerCannotLeave",
            "The organizer cannot be removed; delete the game to end it",
        )

    participant = db.get(GameParticipant, (game.id, user_id))
    if participant is None:
        raise api_error(409, "notJoined", "That user has not joined this game")

    db.delete(participant)
    db.commit()
    return JoinResult(
        message="Player removed successfully",
        game_id=game.id,
        players_joined=count_players(db, game.id),
    )


@router.get("/{game_id}/players", response_model=PlayerList)
def list_players(game_id: int, current_user: CurrentUser, db: DatabaseSession) -> PlayerList:
    game = get_game_or_error(db, game_id)
    return PlayerList(
        game_id=game.id,
        capacity=game.capacity,
        players_joined=len(game.participants),
        players=[
            ParticipantRead(user_id=p.user_id, username=p.user.username)
            for p in game.participants
        ],
    )
