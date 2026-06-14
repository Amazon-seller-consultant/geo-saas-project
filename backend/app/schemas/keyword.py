from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class KeywordCreate(BaseModel):
    keyword_text: str = Field(min_length=1, max_length=500)
    target_domain: str = Field(min_length=1, max_length=255)
    competitor_domains: list[str] = Field(default_factory=list, max_length=10)


class KeywordUpdate(BaseModel):
    competitor_domains: list[str] = Field(default_factory=list, max_length=10)


class KeywordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    keyword_text: str
    target_domain: str
    competitor_domains: list[str]
    last_checked: Optional[datetime] = None
    created_at: datetime


class CompetitorMention(BaseModel):
    is_mentioned: bool
    citation_rank: Optional[int] = None


class RankHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_mentioned: bool
    ai_response_snippet: Optional[str] = None
    source_url: Optional[str] = None
    citation_rank: Optional[int] = None
    competitor_mentions: dict[str, CompetitorMention] = Field(default_factory=dict)
    checked_at: datetime
