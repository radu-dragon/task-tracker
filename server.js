const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Connection string comes from the environment (set as a secret/env var on the platform).
// If it is missing, fall back to in-memory storage so the app still boots and the demo doesn't die.
// The platform's injected DB secret names are not documented yet, so accept either a single
// DATABASE_URL or the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE),
// which pg reads natively when no connectionString is passed.
const DATABASE_URL = process.env.DATABASE_URL;
const hasPgVars = Boolean(process.env.PGHOST);

// Log the NAMES (never values) of DB-looking env vars, to discover what the platform injects.
const dbVarNames = Object.keys(process.env)
  .filter((k) => /DATABASE|POSTGRES|^PG|^DB_|^DB$/i.test(k))
  .sort();
console.log("db-related env var names:", dbVarNames.length ? dbVarNames.join(", ") : "(none)");

const pool =
  DATABASE_URL || hasPgVars
    ? new Pool({
        ...(DATABASE_URL ? { connectionString: DATABASE_URL } : {}),
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
      })
    : null;

let memTasks = [];
let memId = 1;

const store = pool
  ? {
      async init() {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            done BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
      },
      async list() {
        return (await pool.query("SELECT * FROM tasks ORDER BY id DESC")).rows;
      },
      async create(title) {
        return (await pool.query("INSERT INTO tasks (title) VALUES ($1) RETURNING *", [title])).rows[0];
      },
      async update(id, { title, done }) {
        return (
          await pool.query(
            "UPDATE tasks SET title = COALESCE($2, title), done = COALESCE($3, done) WHERE id = $1 RETURNING *",
            [id, title ?? null, done ?? null]
          )
        ).rows[0];
      },
      async remove(id) {
        return (await pool.query("DELETE FROM tasks WHERE id = $1", [id])).rowCount > 0;
      },
    }
  : {
      async init() {},
      async list() {
        return [...memTasks].reverse();
      },
      async create(title) {
        const t = { id: memId++, title, done: false, created_at: new Date().toISOString() };
        memTasks.push(t);
        return t;
      },
      async update(id, { title, done }) {
        const t = memTasks.find((x) => x.id === id);
        if (!t) return undefined;
        if (title !== undefined) t.title = title;
        if (done !== undefined) t.done = done;
        return t;
      },
      async remove(id) {
        const before = memTasks.length;
        memTasks = memTasks.filter((x) => x.id !== id);
        return memTasks.length < before;
      },
    };

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });

app.get("/health", (req, res) => res.json({ status: "ok", storage: pool ? "postgres" : "memory" }));

app.get("/api/tasks", wrap(async (req, res) => res.json(await store.list())));

app.post("/api/tasks", wrap(async (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  res.status(201).json(await store.create(title));
}));

app.put("/api/tasks/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  const { title, done } = req.body;
  const t = await store.update(id, {
    title: typeof title === "string" ? title.trim() || undefined : undefined,
    done: typeof done === "boolean" ? done : undefined,
  });
  if (!t) return res.status(404).json({ error: "not found" });
  res.json(t);
}));

app.delete("/api/tasks/:id", wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
  (await store.remove(id)) ? res.status(204).end() : res.status(404).json({ error: "not found" });
}));

store
  .init()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`task-tracker on :${PORT} (${pool ? "postgres" : "memory"})`)))
  .catch((err) => {
    console.error("startup failed:", err.message);
    process.exit(1);
  });
