import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User


class SkillLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


# Order used when sorting by skill level (lowest to highest).
SKILL_LEVEL_ORDER = [level.value for level in SkillLevel]

MAX_GAME_HOURS = 6


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    organizer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(120), nullable=False)
    game_name: Mapped[str] = mapped_column(String(60), nullable=False)

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    location: Mapped[str] = mapped_column(String(255), nullable=False)
    # Geocoded once when the post is saved; browsing never calls the geocoder.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_online: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    skill_level: Mapped[str] = mapped_column(String(12), nullable=False)
    language: Mapped[str] = mapped_column(
        String(40), nullable=False, default="English", server_default="English"
    )
    # Includes the organizer.
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    equipment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)),
        nullable=False,
        default=list,
        server_default=text("'{}'"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organizer: Mapped[User] = relationship(User, lazy="joined")
    participants: Mapped[list["GameParticipant"]] = relationship(
        "GameParticipant",
        back_populates="game",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="GameParticipant.joined_at",
    )

    __table_args__ = (
        CheckConstraint("capacity >= 1", name="ck_games_capacity_positive"),
        CheckConstraint("end_time > start_time", name="ck_games_end_after_start"),
        CheckConstraint(
            f"end_time - start_time <= interval '{MAX_GAME_HOURS} hours'",
            name="ck_games_max_duration",
        ),
        CheckConstraint(
            "skill_level IN ('beginner', 'intermediate', 'advanced')",
            name="ck_games_skill_level",
        ),
        Index("ix_games_end_time", "end_time"),
    )


class GameParticipant(Base):
    """A user on a game's roster. Deleted together with the game."""

    __tablename__ = "game_participants"

    game_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("games.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    game: Mapped[Game] = relationship("Game", back_populates="participants")
    user: Mapped[User] = relationship(User, lazy="joined")
