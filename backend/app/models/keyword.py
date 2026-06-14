from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in tests).
JSONVariant = JSON().with_variant(JSONB, "postgresql")


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    keyword_text: Mapped[str] = mapped_column(String(500), nullable=False)
    target_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    competitor_domains: Mapped[list[str]] = mapped_column(JSONVariant, nullable=False, default=list)
    last_checked: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="keywords")
    rank_history: Mapped[list["RankHistory"]] = relationship(
        back_populates="keyword", cascade="all, delete-orphan"
    )
