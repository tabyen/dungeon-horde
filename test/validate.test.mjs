import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRoomCode, newRoomCode, parseName, parseReport, parseRoomCode, parseRun, pingOk, sessionSubmitOk } from "../js/validate.js";

function good(over = {}) {
  return {
    game: "dungeon-horde",
    board: "candle",
    room: "",
    name: "Sam",
    classId: "rogue",
    timeMs: 120000,
    kills: 40,
    floor: 3,
    level: 5,
    ...over,
  };
}

test("accepts a normal run", () => {
  const r = parseRun(good());
  assert.equal(r.ok, true);
  assert.equal(r.run.nameKey, "sam");
  assert.equal(r.run.room, "");
});

test("rejects a fake 10 million kills", () => {
  const r = parseRun(good({ kills: 10_000_000 }));
  assert.equal(r.ok, false);
});

test("rejects a 999-hour lantern", () => {
  const r = parseRun(good({ timeMs: 999 * 3600 * 1000 }));
  assert.equal(r.ok, false);
});

test("accepts a name report", () => {
  const r = parseReport({ game: "dungeon-horde", board: "black", room: "ab3-k7q", name: "Sam", note: "spam" });
  assert.equal(r.ok, true);
  assert.equal(r.report.room, "AB3K7Q");
  assert.equal(r.report.note, "spam");
});

test("rejects a report with a blocked name", () => {
  const r = parseReport({ game: "dungeon-horde", board: "candle", room: "", name: "admin" });
  assert.equal(r.ok, false);
});

test("normalizes a room code with a hyphen", () => {
  const r = parseRoomCode("ab3-k7q");
  assert.equal(r.ok, true);
  assert.equal(r.code, "AB3K7Q");
  assert.equal(formatRoomCode(r.code), "AB3-K7Q");
});

test("empty room is the public wall", () => {
  assert.equal(parseRoomCode("").code, "");
});

test("blocks a short name and a blocked name", () => {
  assert.equal(parseName("A").ok, false);
  assert.equal(parseName("admin").ok, false);
  assert.equal(parseName("Sam O'Neil").ok, true);
});

test("new room codes are 6 chars from the alphabet", () => {
  const code = newRoomCode(new Uint8Array([1, 2, 3, 4, 5, 6]));
  assert.equal(code.length, 6);
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
});

test("rejects a floor that could not have been reached", () => {
  const r = parseRun(good({ timeMs: 4000, kills: 2, floor: 8, level: 1 }));
  assert.equal(r.ok, false);
});

test("rejects a lantern level with too few kills", () => {
  const r = parseRun(good({ timeMs: 20000, kills: 2, floor: 1, level: 20 }));
  assert.equal(r.ok, false);
});

test("a dense played run is under the spawn ceiling", () => {
  const r = parseRun(good({ timeMs: 898_147, kills: 2230, floor: 1, level: 26 }));
  assert.equal(r.ok, true);
});

test("kills far above the spawner are rejected", () => {
  const r = parseRun(good({ timeMs: 600_000, kills: 500_000, floor: 1, level: 5 }));
  assert.equal(r.ok, false);
});

test("a short run cannot carry a capped floor", () => {
  const r = parseRun(good({ timeMs: 35_000, kills: 80, floor: 6, level: 4 }));
  assert.equal(r.ok, false);
});

test("session ping cannot claim more time than the wall clock", () => {
  const startedAt = 1_000_000;
  const now = startedAt + 5_000;
  assert.equal(pingOk({ startedAt, now, lastTMs: 0, tMs: 60_000 }).ok, false);
  assert.equal(pingOk({ startedAt, now, lastTMs: 0, tMs: 4_000 }).ok, true);
});

test("one ping cannot jump the clock or the kill count", () => {
  const startedAt = 1_000_000;
  const now = startedAt + 8 * 60 * 60 * 1000;
  const jump = pingOk({
    startedAt,
    now,
    lastPingAt: startedAt,
    lastTMs: 0,
    tMs: 28_500_000,
    kills: 100,
    floor: 1,
    level: 1,
  });
  assert.equal(jump.ok, false);
  const spike = pingOk({
    startedAt,
    now: startedAt + 7_000,
    lastPingAt: startedAt,
    lastTMs: 0,
    tMs: 7_000,
    kills: 171030,
    floor: 1,
    level: 1,
  });
  assert.equal(spike.ok, false);
});

test("a normal ping with a few kills is accepted", () => {
  const startedAt = 1_000_000;
  const r = pingOk({
    startedAt,
    now: startedAt + 7_000,
    lastPingAt: startedAt,
    lastTMs: 0,
    tMs: 6_800,
    kills: 12,
    floor: 1,
    level: 2,
  });
  assert.equal(r.ok, true);
});

test("submit without waiting is rejected", () => {
  const startedAt = 1_000_000;
  const now = startedAt + 2_000;
  const r = sessionSubmitOk({
    startedAt,
    now,
    lastTMs: 0,
    lastPingAt: startedAt,
    pingN: 1,
    timeMs: 180_000,
    submitted: 0,
  });
  assert.equal(r.ok, false);
});

test("a waited run with pings is accepted", () => {
  const startedAt = 1_000_000;
  const now = startedAt + 125_000;
  const r = sessionSubmitOk({
    startedAt,
    now,
    lastTMs: 120_000,
    lastPingAt: now - 3_000,
    pingN: 18,
    timeMs: 120_000,
    submitted: 0,
  });
  assert.equal(r.ok, true);
});
