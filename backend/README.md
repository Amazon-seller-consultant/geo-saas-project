# GEO Analytics & Auditor — Backend

FastAPI backend for the GEO Analytics & Auditor SaaS platform.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in OPENAI_API_KEY and DB/Redis URLs
```

## Run infrastructure (Postgres + Redis)

```bash
docker compose -f ../docker-compose.yml up -d
```

## Run migrations

```bash
alembic revision --autogenerate -m "init schema"
alembic upgrade head
```

## Run the API

```bash
uvicorn app.main:app --reload
```

`GET /health` returns `{"status": "ok"}` once running.

## API

Interactive docs available at `/docs` once the server is running.

### Auth (`/api/auth`)
- `POST /api/auth/signup` — `{email, password}` → creates a user (`subscription_tier=free`).
- `POST /api/auth/login` — OAuth2 password form (`username`=email, `password`) → `{access_token, token_type}` JWT.

All `/api/keywords` routes require `Authorization: Bearer <access_token>`.

### Keywords (`/api/keywords`)
- `POST /api/keywords` — `{keyword_text, target_domain}` → create a tracked keyword for the current user.
- `GET /api/keywords` — list the current user's keywords.
- `GET /api/keywords/{id}` — get a single keyword (must be owned by the current user).
- `DELETE /api/keywords/{id}` — delete a keyword.
- `POST /api/keywords/{id}/check` — run `check_keyword_mention` (cached within `RANK_CHECK_CACHE_HOURS`), returns a `RankCheckResult`.
- `GET /api/keywords/{id}/history` — list `RankHistory` entries for the keyword, most recent first.

### Audits (`/api/audits`)
- `POST /api/audits` — `{content?, url?, title?}` (one of `content`/`url` required) → runs the GEO
  Content Auditor and returns/persists an `AuditOut` (`geo_score` 0-100 + `suggestions_json`).
- `GET /api/audits` — list the current user's audit logs, most recent first.
- `GET /api/audits/{id}` — get a single audit log.

> **Note:** Modules 1 and 2 require `openai>=1.66` for the Responses API
> (`client.responses.create`, `tools=[{"type": "web_search"}]`, `text.format` with
> `json_schema`). `requirements.txt` pins `openai==1.109.1`.

## Module 1: AI Rank Tracker

`app/services/rank_tracker.py` exposes `check_keyword_mention(keyword, db)`, which:

1. Returns the cached `RankHistory` row if `keyword.last_checked` is within
   `RANK_CHECK_CACHE_HOURS` (default 24h).
2. Otherwise queries OpenAI's Responses API (`gpt-4.1` + `web_search` tool) with a prompt built
   from `keyword.keyword_text`.
3. Parses `url_citation` annotations and the response text to detect whether
   `keyword.target_domain` is mentioned/cited, including its citation rank and a text snippet.
4. Persists a new `RankHistory` row, updates `keyword.last_checked`, and returns a
   `RankCheckResult` (Pydantic model in `app/schemas/rank_tracker.py`).

### Manual test

```python
from app.db.base import SessionLocal
from app.models.user import User
from app.models.keyword import Keyword
from app.services.rank_tracker import check_keyword_mention

db = SessionLocal()
user = User(email="test@example.com", password_hash="x", subscription_tier="free")
db.add(user)
db.commit()

keyword = Keyword(
    user_id=user.id,
    keyword_text="CRM tools for small businesses",
    target_domain="hubspot.com",
)
db.add(keyword)
db.commit()

result = check_keyword_mention(keyword, db)
print(result.model_dump_json(indent=2))

# A second call within 24h returns from_cache=True without calling the OpenAI API
print(check_keyword_mention(keyword, db).from_cache)
```

## Module 2: GEO Content Auditor

`app/services/content_auditor.py` exposes:

- `fetch_url_content(url)` — fetches a page and extracts its `<title>` and visible text (via
  `httpx` + BeautifulSoup), stripping scripts/styles/nav/footer.
- `analyze_content(content)` — runs the `GEO_EVALUATION_SYSTEM_PROMPT` against OpenAI's Responses
  API using a strict `json_schema` response format (`AUDIT_RESULT_JSON_SCHEMA`), and returns an
  `AuditResult` (Pydantic model with `geo_score: int` and `suggestions: list[Suggestion]`).

The evaluation prompt scores content on: entity density / knowledge-graph readiness, LLM-friendly
direct definitions, structured tables/lists, and FAQ schema alignment — matching the spec's
GEO Content Auditor criteria.

`POST /api/audits` ties this together: if `url` is given it's fetched via `fetch_url_content`,
otherwise `content` is used directly; the result is persisted as an `AuditLog` row
(`content_title`, `geo_score`, `suggestions_json`).

### Manual test

```python
from app.db.base import SessionLocal
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.content_auditor import analyze_content

db = SessionLocal()
user = db.query(User).first()

result = analyze_content("Your blog post text here...")
print(result.model_dump_json(indent=2))

audit_log = AuditLog(
    user_id=user.id,
    content_title="My Blog Post",
    geo_score=result.geo_score,
    suggestions_json={"suggestions": [s.model_dump() for s in result.suggestions]},
)
db.add(audit_log)
db.commit()
```
