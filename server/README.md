# Server

Node/Express + SQLite (better-sqlite3) with Drizzle ORM.

- Lists, memberships (roles), invites, tasks
- Global /tasks view across all lists for current user
- Fake auth via X-User-Id header (defaults to demo-user)

## Setup

1. Copy `.env.example` to `.env` and adjust if needed
2. Install deps
3. Run dev server

## Env
- PORT (default 4000)
- DATABASE_URL e.g. `sqlite:./data/app.db`
- CORS_ORIGIN e.g. `http://localhost:5173`
