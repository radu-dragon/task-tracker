# Task Tracker

A small Node.js + Postgres CRUD app: add tasks, mark them done, delete them. Built as a proof of concept for deploying on Harness Vibe (beta).

A static-only fallback lives in the sibling repo [`static-fallback`](https://github.com/radu-dragon/static-fallback).

## Stack

- Node.js (>= 18), Express 4
- Postgres via `pg` (optional, see Storage)
- Plain HTML/JS front end in `public/`, no build step

## Project layout

| Path | Purpose |
|---|---|
| `server.js` | Express server: static UI, JSON API, storage layer |
| `public/index.html` | Front end; shows the active storage backend |
| `vibe.yaml` | Draft Harness Vibe config (see below) |
| `package.json` | Dependencies; `npm start` runs the server |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | unset | Postgres connection string. If unset, the app uses in-memory storage |
| `PGSSL` | unset | Set to `true` to enable SSL for the Postgres connection |

Never commit real connection strings. Provide `DATABASE_URL` as a secret on the platform. `.env` is git-ignored.

## Storage

- **Postgres** when `DATABASE_URL` is set. The `tasks` table (`id`, `title`, `done`, `created_at`) is created on startup.
- **In-memory** when it is not. Data is lost on restart. This keeps the app bootable without a database, but it can mask a missing connection, so check `/health`.

## Run locally

```sh
npm install
npm start                                                          # in-memory
DATABASE_URL=postgres://user:pass@localhost:5432/tasks npm start   # Postgres
```

Open http://localhost:3000.

## API

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/health` | | `{ "status": "ok", "storage": "postgres" \| "memory" }` |
| GET | `/api/tasks` | | Newest first |
| POST | `/api/tasks` | `{ "title": "..." }` | 201; 400 if title is empty |
| PUT | `/api/tasks/:id` | `{ "title"?, "done"? }` | 404 if not found |
| DELETE | `/api/tasks/:id` | | 204; 404 if not found |

## Deploying on Harness Vibe

- Source: GitHub (the only code source in beta). Supported shape: Node.js app with Harness Database (Postgres).
- `vibe.yaml` defines a public `web` service (health check on `/health`) and a `db` Postgres 16 workload, with a smaller size in `preview`.
- **`vibe.yaml` is an unvalidated draft** adapted from a design doc. The backend may not require it at intake.
- **Open item:** map the platform-injected database secret to `DATABASE_URL`. Until then the app falls back to memory. After deploying, confirm `/health` reports `"storage": "postgres"`.
