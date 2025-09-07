# Todo-list App (PWA)

A small collaborative Todo PWA: multi-list (TimeTree-like), invites, roles, and a global cross-list view.

Highlights
- Multi-list workspaces you can share
- Team roles: owner, admin, member (permissions enforced server-side)
- Invite-by-link (token) join flow
- Global All Tasks view across your lists
- PWA shell with basic offline caching

Tech stack
- Client: React 18 + Vite + TypeScript, React Router 6
- Server: Node/Express
- Storage: simple JSON file store at `server/data/store.json` (no DB setup)

Monorepo layout
- `client/` React PWA
- `server/` API server + JSON storage

Quick start
1) Start API (port 4000)
	- See `server/README.md` for details
2) Start Web (port 5173)
	- See `client/README.md` for details

Using the app
- Switch user in the header (defaults to `demo-user`).
- Create a list (Lists page). It appears in the left sidebar.
- Open the list to add tasks (owner/admin only), assign members, and set due dates.
- Click Create Invite to get a join URL. Switch user to `alice` and open the URL (or paste token in the Lists page join box) to join.
- Use All Tasks to see tasks across all lists you belong to.

Notes
- Auth is simulated via `X-User-Id` header. The client exposes a simple user switcher.
- Data persists to `server/data/store.json` (good for demos; not for production).

Troubleshooting
- Port in use (EADDRINUSE): stop extra dev servers or start on another port (e.g. `PORT=4001`).
- Client can’t reach API: ensure server is running and client proxy points to `http://localhost:4000` (see `client/vite.config.ts`).
