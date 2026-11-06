from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserRead
from app.security import hash_password

from fastapi import Response
from sqlalchemy import func, select

from app.config import settings
from app.schemas.auth import LoginRequest, TokenResponse
from app.security import create_access_token, verify_password


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DatabaseSession = Annotated[Session, Depends(get_db)]

# Used to perform password verification even when an account is not found.
DUMMY_PASSWORD_HASH = hash_password("PugDummyPassword123!")

@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: UserCreate, db: DatabaseSession) -> User:
    user = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()

        diagnostic = getattr(exc.orig, "diag", None)
        constraint_name = getattr(diagnostic, "constraint_name", None)

        if constraint_name == "uq_users_email_lower":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already in use",
            ) from exc

        if constraint_name == "uq_users_username_lower":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already in use",
            ) from exc

        raise

    db.refresh(user)
    return user

@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: DatabaseSession,
    response: Response,
) -> TokenResponse:
    user = db.scalar(
        select(User).where(
            func.lower(User.email) == str(payload.email).lower()
        )
    )

    password_hash = (
        user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    )
    password_matches = verify_password(payload.password, password_hash)

    if user is None or not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )