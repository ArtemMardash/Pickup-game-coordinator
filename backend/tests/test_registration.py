from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models.user import User
from app.security import verify_password

from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.security import (
    JWT_ALGORITHM,
    JWT_AUDIENCE,
    JWT_ISSUER,
    decode_access_token,
)

@pytest.fixture
def registration_context():
    with engine.connect() as connection:
        transaction = connection.begin()

        with Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        ) as session:

            def override_get_db():
                yield session

            previous_overrides = app.dependency_overrides.copy()
            app.dependency_overrides[get_db] = override_get_db

            try:
                with TestClient(app) as client:
                    yield client, session
            finally:
                app.dependency_overrides.clear()
                app.dependency_overrides.update(previous_overrides)
                session.close()
                transaction.rollback()


@pytest.fixture
def registration_payload():
    suffix = uuid4().hex

    return {
        "username": f"player_{suffix}",
        "email": f"player_{suffix}@example.com",
        "password": "ExamplePass123!",
    }


def test_registration_creates_user(
    registration_context,
    registration_payload,
):
    client, session = registration_context
    payload = registration_payload.copy()
    payload["username"] = f"  {payload['username']}  "

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    body = response.json()

    assert set(body) == {
        "id",
        "username",
        "email",
        "notify_non_critical",
        "created_at",
    }
    assert body["username"] == registration_payload["username"]
    assert body["email"] == registration_payload["email"]
    assert body["notify_non_critical"] is True
    assert body["created_at"]

    stored_user = session.get(User, UUID(body["id"]))

    assert stored_user is not None
    assert stored_user.password_hash != payload["password"]
    assert verify_password(payload["password"], stored_user.password_hash)
    assert not verify_password("IncorrectPassword!", stored_user.password_hash)


@pytest.mark.parametrize(
    ("field", "expected_detail"),
    [
        ("email", "Email is already in use"),
        ("username", "Username is already in use"),
    ],
)
def test_registration_rejects_case_insensitive_duplicates(
    registration_context,
    registration_payload,
    field,
    expected_detail,
):
    client, session = registration_context

    first = client.post("/api/auth/register", json=registration_payload)
    assert first.status_code == 201

    duplicate = {
        "username": f"other_{uuid4().hex}",
        "email": f"other_{uuid4().hex}@example.com",
        "password": "AnotherPass123!",
    }
    duplicate[field] = registration_payload[field].upper()

    response = client.post("/api/auth/register", json=duplicate)

    assert response.status_code == 409
    assert response.json()["detail"] == expected_detail

    # The failed registration must not leave the session unusable.
    original_user = session.get(User, UUID(first.json()["id"]))
    assert original_user is not None

    # A later valid registration should still succeed.
    valid = {
        "username": f"valid_{uuid4().hex}",
        "email": f"valid_{uuid4().hex}@example.com",
        "password": "AnotherPass123!",
    }
    assert client.post("/api/auth/register", json=valid).status_code == 201


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("username", "ab"),
        ("username", "   "),
        ("email", "invalid-email"),
        ("password", "short"),
        ("password", "a" * 73),
        ("password", "é" * 37),
    ],
)
def test_registration_rejects_invalid_input(
    registration_context,
    registration_payload,
    field,
    value,
):
    client, session = registration_context
    payload = registration_payload.copy()
    payload[field] = value

    before = session.scalar(select(func.count()).select_from(User))

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422

    for error in response.json()["detail"]:
        assert "input" not in error
        assert "ctx" not in error

    for error in response.json()["detail"]:
        assert payload["password"] not in error["msg"]

    after = session.scalar(select(func.count()).select_from(User))
    assert after == before

def test_login_and_read_current_user(
    registration_context,
    registration_payload,
):
    client, _ = registration_context

    registered = client.post(
        "/api/auth/register",
        json=registration_payload,
    )
    assert registered.status_code == 201

    response = client.post(
        "/api/auth/login",
        json={
            "email": registration_payload["email"].upper(),
            "password": registration_payload["password"],
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert set(body) == {"access_token", "token_type", "expires_in"}
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.access_token_expire_minutes * 60
    assert response.headers["Cache-Control"] == "no-store"

    user_id = decode_access_token(body["access_token"])
    assert str(user_id) == registered.json()["id"]

    profile = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert profile.status_code == 200
    assert profile.json() == registered.json()


@pytest.mark.parametrize("failure", ["wrong_password", "unknown_email"])
def test_login_rejects_incorrect_credentials(
    registration_context,
    registration_payload,
    failure,
):
    client, _ = registration_context

    assert client.post(
        "/api/auth/register",
        json=registration_payload,
    ).status_code == 201

    credentials = {
        "email": registration_payload["email"],
        "password": registration_payload["password"],
    }

    if failure == "wrong_password":
        credentials["password"] = "IncorrectPass123!"
    else:
        credentials["email"] = f"unknown_{uuid4().hex}@example.com"

    response = client.post("/api/auth/login", json=credentials)

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password"}
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert "access_token" not in response.json()


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic invalid"},
        {"Authorization": "Bearer invalid-token"},
    ],
    ids=["missing-header", "wrong-scheme", "malformed-token"],
)
def test_profile_rejects_invalid_authorization(
    registration_context,
    headers,
):
    client, _ = registration_context

    response = client.get("/api/users/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "failure",
    [
        "expired",
        "wrong_signature",
        "missing_exp",
        "missing_sub",
        "invalid_subject",
        "unknown_user",
        "wrong_audience",
        "wrong_issuer",
    ],
)
def test_profile_rejects_invalid_token_claims(
    registration_context,
    registration_payload,
    failure,
):
    client, _ = registration_context

    registered = client.post(
        "/api/auth/register",
        json=registration_payload,
    )
    assert registered.status_code == 201

    now = datetime.now(timezone.utc)
    payload = {
        "sub": registered.json()["id"],
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }
    signing_key = settings.jwt_secret_key

    if failure == "expired":
        payload["iat"] = now - timedelta(minutes=10)
        payload["exp"] = now - timedelta(minutes=5)
    elif failure == "wrong_signature":
        signing_key = settings.jwt_secret_key + "-different"
    elif failure == "missing_exp":
        del payload["exp"]
    elif failure == "missing_sub":
        del payload["sub"]
    elif failure == "invalid_subject":
        payload["sub"] = "not-a-uuid"
    elif failure == "unknown_user":
        payload["sub"] = str(uuid4())
    elif failure == "wrong_audience":
        payload["aud"] = "another-client"
    elif failure == "wrong_issuer":
        payload["iss"] = "another-api"

    token = jwt.encode(
        payload,
        signing_key,
        algorithm=JWT_ALGORITHM,
    )

    response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Could not validate credentials",
    }
    assert response.headers["WWW-Authenticate"] == "Bearer"

@pytest.fixture
def authenticated_account(registration_context, registration_payload):
    client, session = registration_context

    registered = client.post(
        "/api/auth/register",
        json=registration_payload,
    )
    assert registered.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={
            "email": registration_payload["email"],
            "password": registration_payload["password"],
        },
    )
    assert login.status_code == 200

    headers = {
        "Authorization": f"Bearer {login.json()['access_token']}",
    }

    return client, session, registered.json(), headers

def test_email_update_preserves_identity_and_other_accounts(
    authenticated_account,
    registration_payload,
):
    client, session, original, headers = authenticated_account

    other_payload = {
        "username": f"other_{uuid4().hex}",
        "email": f"other_{uuid4().hex}@example.com",
        "password": "OtherPassword123!",
    }
    other = client.post("/api/auth/register", json=other_payload)
    assert other.status_code == 201

    new_email = f"updated_{uuid4().hex}@example.com"

    response = client.patch(
        "/api/users/me",
        json={"email": new_email},
        headers=headers,
    )

    assert response.status_code == 200
    expected = {**original, "email": new_email}
    assert response.json() == expected

    # The original token still identifies the same account.
    profile = client.get("/api/users/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json() == expected

    # Verify the other account was not changed.
    session.expire_all()
    other_user = session.get(User, UUID(other.json()["id"]))
    assert other_user.email == other_payload["email"]
    assert other_user.notify_non_critical is True

    # Future logins use the updated email.
    new_login = client.post(
        "/api/auth/login",
        json={
            "email": new_email,
            "password": registration_payload["password"],
        },
    )
    assert new_login.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={
            "email": registration_payload["email"],
            "password": registration_payload["password"],
        },
    )
    assert old_login.status_code == 401


@pytest.mark.parametrize("enabled", [False, True])
def test_notification_preference_update(
    authenticated_account,
    enabled,
):
    client, _, original, headers = authenticated_account

    # Start with the opposite value to verify an actual change.
    initial = client.patch(
        "/api/users/me",
        json={"notify_non_critical": not enabled},
        headers=headers,
    )
    assert initial.status_code == 200

    response = client.patch(
        "/api/users/me",
        json={"notify_non_critical": enabled},
        headers=headers,
    )

    expected = {**original, "notify_non_critical": enabled}
    assert response.status_code == 200
    assert response.json() == expected
    assert client.get(
        "/api/users/me",
        headers=headers,
    ).json() == expected


def test_duplicate_email_update_is_atomic(authenticated_account):
    client, _, original, headers = authenticated_account

    other_payload = {
        "username": f"other_{uuid4().hex}",
        "email": f"other_{uuid4().hex}@example.com",
        "password": "OtherPassword123!",
    }
    assert client.post(
        "/api/auth/register",
        json=other_payload,
    ).status_code == 201

    response = client.patch(
        "/api/users/me",
        json={
            "email": other_payload["email"].upper(),
            "notify_non_critical": False,
        },
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email is already in use"}

    # Neither field should change when the update fails.
    profile = client.get("/api/users/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json() == original


@pytest.mark.parametrize(
    "changes",
    [
        {},
        {"email": "invalid-email"},
        {"email": None},
        {"notify_non_critical": None},
        {"notify_non_critical": "false"},
        {"id": str(uuid4())},
        {"username": "someone_else"},
        {"password_hash": "replacement"},
    ],
)
def test_invalid_profile_update_leaves_account_unchanged(
    authenticated_account,
    changes,
):
    client, _, original, headers = authenticated_account

    response = client.patch(
        "/api/users/me",
        json=changes,
        headers=headers,
    )

    assert response.status_code == 422
    assert client.get(
        "/api/users/me",
        headers=headers,
    ).json() == original


def test_profile_update_requires_authentication(registration_context):
    client, _ = registration_context

    response = client.patch(
        "/api/users/me",
        json={"notify_non_critical": False},
    )

    assert response.status_code == 401