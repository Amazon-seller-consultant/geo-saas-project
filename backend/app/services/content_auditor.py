"""Module 2: GEO Content Auditor.

Analyzes a piece of content (raw text or a fetched URL) against a "GEO Evaluation Prompt"
and returns a GEO Score (0-100) plus a structured list of optimization suggestions.
"""

from __future__ import annotations

import json

import httpx
from bs4 import BeautifulSoup
from openai import OpenAI

from app.core.config import settings
from app.schemas.audit import AuditResult

# Maximum number of characters of content sent to the LLM (keeps prompts within token limits).
MAX_CONTENT_CHARS = 12000

GEO_EVALUATION_SYSTEM_PROMPT = """\
You are a GEO (Generative Engine Optimization) auditor. Your job is to evaluate how well a piece \
of written content is optimized for being cited, quoted, and summarized correctly by AI search \
engines and assistants (e.g. ChatGPT Search, Perplexity, Google AI Overviews).

Score the content from 0-100 ("geo_score") based on:
1. Entity density & knowledge graph readiness - are key entities (brands, products, people, \
   concepts) clearly named and unambiguous?
2. LLM-friendly direct definitions - does the content open sections with clear, quotable \
   definitions or direct answers (e.g. "X is a tool that...")?
3. Structured tables/lists - does the content use tables, numbered lists, or bullet points to \
   present comparisons, steps, or features?
4. FAQ schema alignment - does the content include question-and-answer style sections that map \
   well to FAQ structured data?

Provide a list of "suggestions", each with:
- "category": one of "entity_density", "direct_definitions", "structured_data", "faq_alignment"
- "issue": a short description of what is missing or weak
- "recommendation": a concrete, actionable fix

Be specific and reference the actual content provided.
"""

AUDIT_RESULT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "geo_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": [
                            "entity_density",
                            "direct_definitions",
                            "structured_data",
                            "faq_alignment",
                        ],
                    },
                    "issue": {"type": "string"},
                    "recommendation": {"type": "string"},
                },
                "required": ["category", "issue", "recommendation"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["geo_score", "suggestions"],
    "additionalProperties": False,
}

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def fetch_url_content(url: str) -> tuple[str, str]:
    """Fetch a URL and extract a title and the page's visible text content."""
    response = httpx.get(url, follow_redirects=True, timeout=15.0)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else url
    text = soup.get_text(separator="\n", strip=True)
    return title, text


def analyze_content(content: str) -> AuditResult:
    """Run the GEO Evaluation Prompt against `content` and return a structured AuditResult."""
    client = _get_client()
    truncated = content[:MAX_CONTENT_CHARS]

    response = client.responses.create(
        model=settings.OPENAI_MODEL,
        input=[
            {"role": "system", "content": GEO_EVALUATION_SYSTEM_PROMPT},
            {"role": "user", "content": f"Evaluate the following content:\n\n{truncated}"},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "geo_audit_result",
                "schema": AUDIT_RESULT_JSON_SCHEMA,
                "strict": True,
            }
        },
    )

    data = json.loads(response.output_text)
    return AuditResult.model_validate(data)
