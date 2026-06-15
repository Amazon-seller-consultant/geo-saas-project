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
of written content is optimized for being found, cited, quoted, and summarized correctly by AI \
search engines and assistants (e.g. ChatGPT Search, Perplexity, Google AI Overviews, Claude).

Score the content from 0-100 ("geo_score") based on the following seven dimensions:

1. Answer-first / BLUF structure - does the content lead with a direct, concise answer to the \
   likely user question (in the first 1-2 sentences of the page or each major section), before \
   going into supporting detail? AI assistants quote the opening sentences most often.
2. Entity clarity - are key entities (brand names, product names, people, places, concepts) \
   stated explicitly and unambiguously, rather than relying on pronouns, vague references, or \
   marketing fluff? Is it crystal clear *what* the content is about?
3. Structured data & formatting - does the content use tables, numbered lists, bullet points, \
   or other structures that map well to comparisons, steps, specs, or features (and, for a full \
   page, could be marked up with schema.org types like FAQPage, HowTo, Article, or Product)?
4. Conversational Q&A coverage - does the content include question-style headings or sections \
   that mirror how people naturally ask AI assistants questions (e.g. "How much does X cost?", \
   "Is X safe for Y?", "What is the difference between X and Z?")?
5. E-E-A-T signals - does the content demonstrate experience, expertise, authoritativeness, and \
   trust? Look for author names/credentials, cited sources or data, statistics, case studies, \
   testimonials, or other credibility markers that AI models weigh when deciding what to cite.
6. Content depth & originality - does the content go beyond generic, surface-level information? \
   Does it include specific data, unique insights, examples, or details that a generic AI answer \
   would not already have - making this source worth citing?
7. Freshness signals - is there any indication of when the content was written or last updated \
   (dates, "as of", version numbers, recent events/data)? AI search engines favor recently \
   updated sources for time-sensitive topics.

Provide a list of "suggestions", each with:
- "category": one of "answer_first", "entity_clarity", "structured_data", "conversational_qa", \
  "eeat_signals", "content_depth", "freshness"
- "issue": a short description of what is missing or weak
- "recommendation": a concrete, actionable fix

Do NOT produce a suggestion with category "technical_crawlability" - that category is reserved \
for an automated technical check and is added separately.

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
                            "answer_first",
                            "entity_clarity",
                            "structured_data",
                            "conversational_qa",
                            "eeat_signals",
                            "content_depth",
                            "freshness",
                            "technical_crawlability",
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

# AI crawler user-agents that should be allowed access for content to be eligible for citation
# in AI search engines and assistants.
AI_CRAWLER_USER_AGENTS = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "PerplexityBot",
    "Google-Extended",
    "ClaudeBot",
    "anthropic-ai",
    "CCBot",
    "Applebot-Extended",
]

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}


def fetch_url_content(url: str) -> tuple[str, str]:
    """Fetch a URL and extract a title and the page's visible text content."""
    response = httpx.get(url, follow_redirects=True, timeout=15.0, headers=_FETCH_HEADERS)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else url
    text = soup.get_text(separator="\n", strip=True)
    return title, text


def _parse_robots_groups(text: str) -> list[tuple[list[str], list[str]]]:
    """Parse robots.txt into a list of (user_agents, disallow_paths) rule groups."""
    groups: list[tuple[list[str], list[str]]] = []
    current_agents: list[str] = []
    current_rules: list[str] = []
    seen_rule_in_group = False

    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        field, _, value = line.partition(":")
        field = field.strip().lower()
        value = value.strip()

        if field == "user-agent":
            if seen_rule_in_group:
                groups.append((current_agents, current_rules))
                current_agents = []
                current_rules = []
                seen_rule_in_group = False
            current_agents.append(value)
        elif field == "disallow":
            current_rules.append(value)
            seen_rule_in_group = True

    if current_agents:
        groups.append((current_agents, current_rules))
    return groups


def check_ai_crawler_access(url: str) -> list[str]:
    """Return the AI crawler user-agents that appear to be fully blocked by robots.txt."""
    parsed = httpx.URL(url)
    robots_url = f"{parsed.scheme}://{parsed.host}/robots.txt"

    try:
        response = httpx.get(robots_url, follow_redirects=True, timeout=10.0, headers=_FETCH_HEADERS)
        if response.status_code != 200:
            return []
        groups = _parse_robots_groups(response.text)
    except Exception:
        return []

    blocked: list[str] = []
    for bot in AI_CRAWLER_USER_AGENTS:
        specific_rules = [
            rules for agents, rules in groups if any(a.lower() == bot.lower() for a in agents)
        ]
        wildcard_rules = [rules for agents, rules in groups if "*" in agents]
        applicable_rules = specific_rules[0] if specific_rules else (
            wildcard_rules[0] if wildcard_rules else []
        )
        if any(rule.strip() == "/" for rule in applicable_rules):
            blocked.append(bot)

    return blocked


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
