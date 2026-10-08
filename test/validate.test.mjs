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

test("session ping cannot claim more time than the wall clock", () => {
  const startedAt = 1_000_000;
  const now = startedAt + 5_000;
  assert.equal(pingOk({ startedAt, now, lastTMs: 0, tMs: 60_000 }).ok, false);
  assert.equal(pingOk({ startedAt, now, lastTMs: 0, tMs: 4_000 }).ok, true);
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
