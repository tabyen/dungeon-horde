import { test } from "node:test";
import assert from "node:assert/strict";
import { TILE, TILE_STAIRS, generateDungeon } from "../js/map.js";

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

test("seeded maps are deterministic", () => {
  const a = generateDungeon({ seed: 99 });
  const b = generateDungeon({ seed: 99 });
  assert.equal(a.rooms.length, b.rooms.length);
  assert.deepEqual(a.spawn, b.spawn);
  assert.deepEqual([...a.tiles], [...b.tiles]);
});
