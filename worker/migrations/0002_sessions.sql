CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  board TEXT NOT NULL,
  class_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_ping_at INTEGER NOT NULL,
  last_t_ms INTEGER NOT NULL DEFAULT 0,
  ping_n INTEGER NOT NULL DEFAULT 0,
  submitted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_started ON sessions (started_at);
