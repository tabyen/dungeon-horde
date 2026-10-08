CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  game TEXT NOT NULL,
  board TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  name_key TEXT NOT NULL,
  name TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  floor INTEGER NOT NULL,
  class_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (game, board, room, name_key)
);

CREATE INDEX IF NOT EXISTS runs_board_time ON runs (game, board, room, time_ms DESC);

CREATE TABLE IF NOT EXISTS rate (
  ip TEXT NOT NULL,
  bucket TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, bucket)
);
