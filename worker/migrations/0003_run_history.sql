CREATE TABLE runs_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at INTEGER NOT NULL
);

INSERT INTO runs_v2 (game, board, room, name_key, name, time_ms, kills, floor, class_id, level, created_at)
SELECT game, board, room, name_key, name, time_ms, kills, floor, class_id, level, created_at FROM runs;

DROP TABLE runs;
ALTER TABLE runs_v2 RENAME TO runs;

CREATE INDEX runs_board_time ON runs (game, board, room, time_ms DESC);
CREATE INDEX runs_name ON runs (game, board, room, name_key, time_ms DESC);
