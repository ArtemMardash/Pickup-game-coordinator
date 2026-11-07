from datetime import datetime, timedelta, timezone
from typing import Literal, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.game import MAX_GAME_HOURS, SkillLevel

MAX_DURATION = timedelta(hours=MAX_GAME_HOURS)


def _require_timezone(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        raise ValueError("Timestamp must include a timezone offset")
    return value


def _clean_tags(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    cleaned: list[str] = []
    for tag in value:
        tag = tag.strip()
        if tag and tag.lower() not in {t.lower() for t in cleaned}:
            cleaned.append(tag)
    return cleaned


class GameCreate(BaseModel):
    """Body of POST /api/games (plan B.3)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    game_name: str = Field(min_length=1, max_length=60)
    start_time: datetime
    end_time: datetime
    location: str = Field(min_length=1, max_length=255)
    skill_level: SkillLevel
    capacity: int = Field(ge=1, le=1000)

    language: str = Field(default="English", min_length=1, max_length=40)
    is_online: bool = False
    # Geocoded coordinates for the map. Optional until geocoding is wired in.
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = Field(default=None, max_length=2000)
    equipment_notes: str | None = Field(default=None, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("title", "game_name", "location", "language", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("start_time", "end_time")
    @classmethod
    def tz_required(cls, value: datetime) -> datetime:
        return _require_timezone(value)

    @field_validator("tags")
    @classmethod
    def tags_clean(cls, value: list[str]) -> list[str]:
        cleaned = _clean_tags(value) or []
        if any(len(t) > 30 for t in cleaned):
            raise ValueError("Each tag must be 30 characters or fewer")
        return cleaned

    @model_validator(mode="after")
    def check_times_and_coordinates(self) -> Self:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.end_time - self.start_time > MAX_DURATION:
            raise ValueError(f"A game cannot last longer than {MAX_GAME_HOURS} hours")
        if self.end_time <= datetime.now(timezone.utc):
            raise ValueError("end_time must be in the future")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        return self


class GameUpdate(BaseModel):
    """Body of PATCH /api/games/{id}. Only the fields sent are changed."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=120)
    game_name: str | None = Field(default=None, min_length=1, max_length=60)
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: str | None = Field(default=None, min_length=1, max_length=255)
    skill_level: SkillLevel | None = None
    capacity: int | None = Field(default=None, ge=1, le=1000)

    language: str | None = Field(default=None, min_length=1, max_length=40)
    is_online: bool | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    description: str | None = Field(default=None, max_length=2000)
    equipment_notes: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("title", "game_name", "location", "language", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("start_time", "end_time")
    @classmethod
    def tz_required(cls, value: datetime | None) -> datetime | None:
        return _require_timezone(value)

    @field_validator("tags")
    @classmethod
    def tags_clean(cls, value: list[str] | None) -> list[str] | None:
        cleaned = _clean_tags(value)
        if cleaned and any(len(t) > 30 for t in cleaned):
            raise ValueError("Each tag must be 30 characters or fewer")
        return cleaned

    @model_validator(mode="after")
    def no_null_required_fields(self) -> Self:
        # Optional-in-the-model fields cannot be cleared to null if required.
        for name in (
            "title",
            "game_name",
            "start_time",
            "end_time",
            "location",
            "skill_level",
            "capacity",
            "language",
            "is_online",
            "tags",
        ):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    username: str


class GameRead(BaseModel):
    """Game as returned by GET /api/games/{id} (plan B.4)."""

    game_id: int
    title: str
    game_name: str
    organizer_id: UUID
    organizer_username: str
    start_time: datetime
    end_time: datetime
    location: str
    latitude: float | None
    longitude: float | None
    is_online: bool
    skill_level: SkillLevel
    language: str
    capacity: int
    players_joined: int
    spots_left: int
    status: Literal["upcoming", "active"]
    description: str | None
    equipment_notes: str | None
    tags: list[str]
    participants: list[ParticipantRead]


class GameSummary(BaseModel):
    """Compact game for the list / map (no roster)."""

    game_id: int
    title: str
    game_name: str
    organizer_id: UUID
    organizer_username: str
    start_time: datetime
    end_time: datetime
    location: str
    latitude: float | None
    longitude: float | None
    is_online: bool
    skill_level: SkillLevel
    language: str
    capacity: int
    players_joined: int
    spots_left: int
    status: Literal["upcoming", "active"]
    tags: list[str]
    distance_km: float | None = None


class GameList(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[GameSummary]


class GameCreated(BaseModel):
    status: Literal["success"] = "success"
    message: str = "Game created successfully"
    game_id: int


class GameDeleted(BaseModel):
    status: Literal["success"] = "success"
    message: str = "Game deleted successfully"
    game_id: int


class JoinResult(BaseModel):
    status: Literal["success"] = "success"
    message: str
    game_id: int
    players_joined: int


class PlayerList(BaseModel):
    game_id: int
    capacity: int
    players_joined: int
    players: list[ParticipantRead]
