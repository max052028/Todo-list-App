# Client (React PWA)

Stack
- Vite + React + TypeScript + React Router
- PWA manifest and a simple service worker

Dev
```bash
npm install
npm run dev
# opens http://localhost:5173
```

Build & Preview
```bash
npm run build
npm run preview
# serves built files at http://localhost:5173
```

API Proxy
- Dev proxy maps `^/api` to `http://localhost:4000` (see `vite.config.ts`).

Routes
- `/` Lists (create list, join-by-link)
- `/lists/:id` List Detail (tasks, members, invites)
- `/tasks` All Tasks (cross-list)
- `/join/:token` Join by invite link

Usage tips
- Header has a simple user switcher that sets `X-User-Id`.
- Owners/admins can create tasks and invites; owners can change roles.

Common issues
- API not reachable: ensure server is running on `:4000`.
- Stuck loading: hard refresh; confirm `/api/health` returns `{ ok: true }`.
