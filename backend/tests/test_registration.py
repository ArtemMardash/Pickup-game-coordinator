from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models.user import User
from app.security import verify_password


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