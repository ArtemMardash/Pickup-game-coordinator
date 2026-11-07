from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate


router = APIRouter(prefix="/api/users", tags=["Users"])

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_current_user(
    payload: UserUpdate,
    current_user: CurrentUser,
    db: DatabaseSession,
) -> User:
    changes = payload.model_dump(exclude_unset=True)

    for field, value in changes.items():
        setattr(current_user, field, value)

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

        raise

    db.refresh(current_user)
    return current_user