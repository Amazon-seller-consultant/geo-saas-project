from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator


class AuditCreate(BaseModel):
    """Either `content` (raw text) or `url` (a page to fetch and analyze) must be provided."""

    content: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None

    @model_validator(mode="after")
    def _check_content_or_url(self) -> "AuditCreate":
        if not self.content and not self.url:
            raise ValueError("Either 'content' or 'url' must be provided")
        return self


class Suggestion(BaseModel):
    category: str
    issue: str
    recommendation: str


class AuditResult(BaseModel):
    """Strict JSON contract returned by the GEO Content Auditor for a single piece of content."""

    geo_score: int
    suggestions: list[Suggestion]


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content_title: str
    geo_score: int
    suggestions_json: dict
    created_at: datetime
