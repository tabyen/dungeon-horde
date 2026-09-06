import { test } from "node:test";
import assert from "node:assert/strict";
import { TILE, TILE_STAIRS, generateDungeon, buildFlowField } from "../js/map.js";

test("dungeon has rooms, floors, and stairs", () => {
  const d = generateDungeon({ seed: 42 });
  assert.ok(d.rooms.length >= 5, `expected >= 5 rooms, got ${d.rooms.length}`);
  assert.ok(d.floors.length > 80, `expected many floor tiles, got ${d.floors.length}`);
  assert.equal(d.get(d.stairs.x, d.stairs.y), TILE_STAIRS);
  assert.equal(d.isWalkable(d.spawn.x, d.spawn.y), true);
  assert.equal(d.circleHitsWall(d.worldX(d.spawn.x), d.worldY(d.spawn.y), 11), false);
});

test("walls surround the map edge", () => {
  const d = generateDungeon({ seed: 7, width: 40, height: 30 });
  for (let x = 0; x < d.width; x++) {
    assert.equal(d.isWalkable(x, 0), false);
    assert.equal(d.isWalkable(x, d.height - 1), false);
  }
  const wall = d.circleHitsWall(TILE / 2, TILE / 2, 10);
  assert.equal(wall, true);
});

test("flow field routes around a wall instead of through it", () => {
  const rows = [
    "#######",
    "#A#B..#",
    "#.#...#",
    "#.....#",
    "#######",
  ];
  const height = rows.length;
  const width = rows[0].length;
  const map = {
    width,
    height,
    isWalkable(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return rows[y][x] !== "#";
    },
  };
  const flow = buildFlowField(map, 3, 1);
  const i = (x, y) => y * width + x;
  assert.ok(flow.dist[i(1, 1)] < 32767, "A is reachable from B");
  assert.equal(flow.dx[i(1, 1)], 0);
  assert.equal(flow.dy[i(1, 1)], 1, "A should go down around the wall, not through it");

  let x = 1;
  let y = 1;
  let guard = 0;
  while ((x !== 3 || y !== 1) && guard++ < 40) {
    const idx = i(x, y);
    x += flow.dx[idx];
    y += flow.dy[idx];
    assert.equal(map.isWalkable(x, y), true);
  }
  assert.equal(x, 3);
  assert.equal(y, 1);
});

test("seeded maps are deterministic", () => {
  const a = generateDungeon({ seed: 99 });
  const b = generateDungeon({ seed: 99 });
  assert.equal(a.rooms.length, b.rooms.length);
  assert.deepEqual(a.spawn, b.spawn);
  assert.deepEqual([...a.tiles], [...b.tiles]);
});
