from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# JSONB on Postgres, plain JSON elsewhere (e.g. SQLite in tests).
JSONVariant = JSON().with_variant(JSONB, "postgresql")


class RankHistory(Base):
    __tablename__ = "rank_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    keyword_id: Mapped[int] = mapped_column(ForeignKey("keywords.id", ondelete="CASCADE"), nullable=False)
    is_mentioned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_response_snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    citation_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    competitor_mentions: Mapped[dict] = mapped_column(JSONVariant, nullable=False, default=dict)
    checked_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    keyword: Mapped["Keyword"] = relationship(back_populates="rank_history")
