"""Module 1: AI Rank Tracker.

Core logic for querying an LLM (with live web search) about a keyword/topic and
detecting whether a target domain is mentioned or cited in the response.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.keyword import Keyword
from app.models.rank_history import RankHistory
from app.schemas.rank_tracker import RankCheckResult

# Number of characters to include on each side of a mention when building the snippet.
SNIPPET_RADIUS = 150

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def _build_prompt(keyword_text: str) -> str:
    return (
        f"What are the best {keyword_text}? "
        "Please recommend specific tools, products, or companies and cite your sources."
    )


def _normalize_domain(domain: str) -> str:
    domain = domain.lower().strip()
    domain = domain.removeprefix("https://").removeprefix("http://")
    domain = domain.removeprefix("www.")
    return domain.rstrip("/")


def _extract_citations(response) -> list[str]:
    """Return an ordered list of unique citation URLs from an OpenAI Responses API result."""
    citations: list[str] = []
    for item in getattr(response, "output", []) or []:
        if getattr(item, "type", None) != "message":
            continue
        for content in getattr(item, "content", []) or []:
            for annotation in getattr(content, "annotations", []) or []:
                if getattr(annotation, "type", None) == "url_citation":
                    url = getattr(annotation, "url", None)
                    if url and url not in citations:
                        citations.append(url)
    return citations


def _build_snippet(text: str, index: int) -> str:
    start = max(0, index - SNIPPET_RADIUS)
    end = min(len(text), index + SNIPPET_RADIUS)
    snippet = text[start:end].strip()
    return snippet


def _detect_mention(
    output_text: str, citations: list[str], target_domain: str
) -> tuple[bool, int | None, str | None, str | None]:
    """Check whether `target_domain` appears in the citations or the response text.

    Returns (is_mentioned, citation_rank, source_url, ai_response_snippet).
    """
    normalized_target = _normalize_domain(target_domain)

    # 1. Check cited sources first - these give us a citation rank and source URL.
    for rank, url in enumerate(citations, start=1):
        if normalized_target in _normalize_domain(url):
            index = output_text.find(normalized_target)
            snippet = _build_snippet(output_text, index) if index != -1 else output_text[:300]
            return True, rank, url, snippet

    # 2. Fall back to a plain-text substring check (mention without a citation).
    index = output_text.lower().find(normalized_target)
    if index != -1:
        snippet = _build_snippet(output_text, index)
        return True, None, None, snippet

    return False, None, None, None


def check_keyword_mention(keyword: Keyword, db: Session) -> RankCheckResult:
    """Check whether `keyword.target_domain` is mentioned in an LLM's answer to `keyword.keyword_text`.

    If the keyword was checked within `settings.RANK_CHECK_CACHE_HOURS`, the most recent
    `RankHistory` row is returned instead of making a new API call.
    """
    now = datetime.now(timezone.utc)

    if keyword.last_checked is not None:
        last_checked = keyword.last_checked
        if last_checked.tzinfo is None:
            last_checked = last_checked.replace(tzinfo=timezone.utc)
        cache_age = now - last_checked
        if cache_age < timedelta(hours=settings.RANK_CHECK_CACHE_HOURS):
            cached = (
                db.query(RankHistory)
                .filter(RankHistory.keyword_id == keyword.id)
                .order_by(RankHistory.checked_at.desc())
                .first()
            )
            if cached is not None:
                return RankCheckResult(
                    keyword_id=keyword.id,
                    is_mentioned=cached.is_mentioned,
                    citation_rank=cached.citation_rank,
                    ai_response_snippet=cached.ai_response_snippet,
                    source_url=cached.source_url,
                    competitor_mentions=cached.competitor_mentions,
                    checked_at=cached.checked_at,
                    from_cache=True,
                )

    client = _get_client()
    response = client.responses.create(
        model=settings.OPENAI_MODEL,
        tools=[{"type": "web_search"}],
        input=_build_prompt(keyword.keyword_text),
    )

    output_text = response.output_text
    citations = _extract_citations(response)
    is_mentioned, citation_rank, source_url, snippet = _detect_mention(
        output_text, citations, keyword.target_domain
    )

    competitor_mentions: dict[str, dict] = {}
    for competitor_domain in keyword.competitor_domains:
        comp_mentioned, comp_rank, _, _ = _detect_mention(
            output_text, citations, competitor_domain
        )
        competitor_mentions[competitor_domain] = {
            "is_mentioned": comp_mentioned,
            "citation_rank": comp_rank,
        }

    rank_history = RankHistory(
        keyword_id=keyword.id,
        is_mentioned=is_mentioned,
        ai_response_snippet=snippet,
        source_url=source_url,
        citation_rank=citation_rank,
        competitor_mentions=competitor_mentions,
        checked_at=now,
    )
    db.add(rank_history)

    keyword.last_checked = now
    db.add(keyword)

    db.commit()
    db.refresh(rank_history)

    return RankCheckResult(
        keyword_id=keyword.id,
        is_mentioned=rank_history.is_mentioned,
        citation_rank=rank_history.citation_rank,
        ai_response_snippet=rank_history.ai_response_snippet,
        source_url=rank_history.source_url,
        competitor_mentions=rank_history.competitor_mentions,
        checked_at=rank_history.checked_at,
        from_cache=False,
    )
