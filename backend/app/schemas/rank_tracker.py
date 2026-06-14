from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.keyword import CompetitorMention


class RankCheckResult(BaseModel):
    """Strict JSON contract returned by the AI Rank Tracker for a single keyword check."""

    keyword_id: int
    is_mentioned: bool
    citation_rank: Optional[int] = None
    ai_response_snippet: Optional[str] = None
    source_url: Optional[str] = None
    competitor_mentions: dict[str, CompetitorMention] = Field(default_factory=dict)
    checked_at: datetime
    from_cache: bool = False
