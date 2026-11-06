import bcrypt
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from app.config import settings


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError("Password must not exceed 72 UTF-8 bytes")

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "pug-api"
JWT_AUDIENCE = "pug-client"


def create_access_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.access_token_expire_minutes,
        ),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> UUID:
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[JWT_ALGORITHM],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={"require": ["sub", "iat", "exp", "iss", "aud"]},
    )

    try:
        return UUID(payload["sub"])
    except (ValueError, TypeError, AttributeError) as exc:
        raise jwt.InvalidTokenError("Invalid user identifier") from exc