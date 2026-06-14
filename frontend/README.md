# GEO Analytics & Auditor — Frontend

Next.js (App Router) dashboard for the GEO Analytics & Auditor SaaS platform. Built with
Tailwind v4, Shadcn/ui, Lucide icons, and Recharts.

## Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Then run the dev server:

```bash
npm run dev
```

The backend (`../backend`) must be running with CORS enabled for `http://localhost:3000`
(already configured in `app/main.py`).

## Auth model

The FastAPI backend uses OAuth2 password-flow JWTs (`/api/auth/login`,
`/api/auth/signup`). The frontend stores the access token in `localStorage`
(`src/lib/auth-context.tsx`) and attaches it as `Authorization: Bearer <token>` on every
API request via `src/lib/api.ts`. `src/app/dashboard/layout.tsx` guards all
`/dashboard/*` routes and redirects unauthenticated users to `/login`.

## Structure

- `src/lib/api.ts` — typed fetch client for the FastAPI backend (auth, keywords, audits).
- `src/lib/types.ts` — TypeScript types mirroring the backend Pydantic schemas.
- `src/lib/auth-context.tsx` — client-side auth provider (token storage, login/signup/logout).
- `src/app/login`, `src/app/signup` — auth pages.
- `src/app/dashboard/page.tsx` — Overview: summary cards, Share of Voice pie chart, GEO
  score history line chart (Recharts).
- `src/app/dashboard/keywords/page.tsx` — AI Rank Tracker: add/check/delete keywords,
  view check history.
- `src/app/dashboard/audits/page.tsx` — GEO Content Auditor: run audits from pasted
  content or a URL, view GEO score + suggestions, browse past audits.

## Notes for this sandbox

The system Node (v24) has a broken TLS implementation that segfaults on HTTPS requests
(`npm install`, `npx`, and Google Fonts fetches all fail). A portable Node v22 binary was
downloaded to `/tmp/node-v22.11.0-darwin-arm64/` and is used for all `npm`/`npx` commands
via `export PATH="/tmp/node-v22.11.0-darwin-arm64/bin:$PATH"`. If the system Node is fixed,
this workaround is no longer needed.
