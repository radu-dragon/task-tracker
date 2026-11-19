# Task Tracker (Harness Vibe PoC)

Small Node.js + Postgres CRUD app.

- `npm start` runs the server on `$PORT` (default 3000).
- `DATABASE_URL` selects Postgres. If unset, the app uses in-memory storage (`/health` reports which).
- `PGSSL=true` enables SSL for the Postgres connection if the database requires it.
- Tables are created automatically on startup.

## Local run

```
npm install
npm start                                   # in-memory
DATABASE_URL=postgres://user:pass@localhost:5432/tasks npm start   # Postgres
```

## API

- `GET /health`
- `GET /api/tasks`
- `POST /api/tasks` `{ "title": "..." }`
- `PUT /api/tasks/:id` `{ "title"?, "done"? }`
- `DELETE /api/tasks/:id`

Note: `vibe.yaml` is an unvalidated draft. Replace `<github-org>`, confirm the DATABASE_URL secret mapping, and validate it before relying on it. Onboarding may not need it.
