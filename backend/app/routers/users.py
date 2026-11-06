from fastapi import APIRouter

from app.deps import CurrentUser
from app.models.user import User
from app.schemas.user import UserRead


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: CurrentUser) -> User:
    return current_user