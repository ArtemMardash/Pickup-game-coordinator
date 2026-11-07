from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from typing import Self

from pydantic import StrictBool, model_validator


class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=50)
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=72, repr=False)

    @field_validator("username", mode="before")
    @classmethod
    def trim_username(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes")
        return value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: EmailStr
    notify_non_critical: bool
    created_at: datetime

class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = Field(default=None, max_length=254)
    notify_non_critical: StrictBool | None = None

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")

        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")

        return self