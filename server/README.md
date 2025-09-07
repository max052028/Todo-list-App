# Server

Node/Express API with a JSON file store (no external DB required).

Features
- Lists, memberships (roles), invites, tasks
- Global `/tasks` view across all lists for current user
- Fake auth via `X-User-Id` header (defaults to `demo-user`)

Storage
- Data lives in `data/store.json` (auto-created). See `src/store.js`.

Setup
```bash
npm install
npm run dev
# api listening on :4000
```

Env
- `PORT` (default `4000`)
- `CORS_ORIGIN` (comma-separated list, default allows all in dev)

Build (optional)
```bash
npm run build
npm start
```

API overview (selected)
- `GET /health` → `{ ok: true }`
- `GET /me` → current fake user object
- `GET /lists` → lists I belong to
- `POST /lists` `{ name, color? }` → create list (caller becomes owner)
- `GET /lists/:id/members` → list members
- `PATCH /lists/:id/members/:userId` `{ role }` → owner only
- `POST /lists/:id/invites` → create invite token (owner/admin)
- `POST /join/:token` → join list as `member`
- `GET /lists/:id/tasks` → tasks for list (must be a member)
- `POST /lists/:id/tasks` `{ title, dueAt?, assigneeId? }` → owner/admin only
- `PATCH /tasks/:id` → update if owner/admin or creator/assignee
- `DELETE /tasks/:id` → delete if owner/admin or creator
- `GET /tasks` → all my tasks across lists

Permissions
- Owner/Admin: can create tasks and invites. Owner can change roles and delete lists.
- Member: can read; can update tasks if they created it or they’re the assignee.

Troubleshooting
- EADDRINUSE (port 4000 in use): stop other dev servers or run `PORT=4001 npm run dev`.
- CORS: set `CORS_ORIGIN=http://localhost:5173` (comma-separated for multiple).
