export const GAME_ID = "dungeon-horde";
export const BOARDS = ["lantern", "candle", "black"];
export const CLASS_IDS = ["rogue", "warrior", "wizard"];
export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const NAME_RE = /^[\p{L}\p{N} .'\-]{2,16}$/u;
const BLOCKED = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "fuck",
  "shit",
  "ass",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
]);

const MIN_TIME_MS = 1000;
const MAX_TIME_MS = 8 * 60 * 60 * 1000;

export function normalizeName(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

export function nameKey(name) {
  return name.toLocaleLowerCase();
}

export function parseName(raw) {
  const name = normalizeName(raw);
  if (name.length < 2 || name.length > 16) {
    return { ok: false, error: "name must be 2–16 characters" };
  }
  if (!NAME_RE.test(name)) {
    return { ok: false, error: "name can use letters, numbers, spaces, . ' -" };
  }
  if (BLOCKED.has(nameKey(name))) {
    return { ok: false, error: "pick another name" };
  }
  return { ok: true, name };
}

export function parseRoomCode(raw) {
  const code = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!code) return { ok: true, code: "" };
  if (code.length < 4 || code.length > 8) {
    return { ok: false, error: "room code looks wrong" };
  }
  return { ok: true, code };
}

export function formatRoomCode(code) {
  if (!code) return "";
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

const NOTE_MAX = 280;

export function parseReport(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid report" };
  if (body.game !== GAME_ID) return { ok: false, error: "unknown game" };
  const board = BOARDS.includes(body.board) ? body.board : null;
  if (!board) return { ok: false, error: "unknown light" };
  const room = parseRoomCode(body.room);
  if (!room.ok) return room;
  const named = parseName(body.name);
  if (!named.ok) return named;
  const note = String(body.note || "").trim();
  if (note.length > NOTE_MAX) return { ok: false, error: "note is too long" };
  return { ok: true, report: { game: GAME_ID, board, room: room.code, name: named.name, note } };
}

export function newRoomCode(bytes) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return s;
}

export function parseRun(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid run" };

  const game = body.game === GAME_ID ? GAME_ID : null;
  if (!game) return { ok: false, error: "unknown game" };

  const board = BOARDS.includes(body.board) ? body.board : null;
  if (!board) return { ok: false, error: "unknown light" };

  const room = parseRoomCode(body.room);
  if (!room.ok) return room;

  const named = parseName(body.name);
  if (!named.ok) return named;

  const classId = CLASS_IDS.includes(body.classId) ? body.classId : null;
  if (!classId) return { ok: false, error: "unknown champion" };

  const timeMs = Number(body.timeMs);
  if (!Number.isFinite(timeMs) || timeMs < MIN_TIME_MS || timeMs > MAX_TIME_MS) {
    return { ok: false, error: "time looks wrong" };
  }

  const floor = Number(body.floor);
  const maxFloor = maxFloorForTime(timeMs);
  if (!Number.isInteger(floor) || floor < 1 || floor > 40 || floor > maxFloor) {
    return { ok: false, error: "floor looks wrong" };
  }

  const kills = Number(body.kills);
  const maxKills = maxKillsForTime(timeMs, floor);
  if (!Number.isInteger(kills) || kills < 0 || kills > maxKills) {
    return { ok: false, error: "kills look wrong" };
  }

  const level = Number(body.level);
  const maxLevel = maxLevelForTime(timeMs, kills);
  if (!Number.isInteger(level) || level < 1 || level > 40 || level > maxLevel) {
    return { ok: false, error: "lantern level looks wrong" };
  }

  return {
    ok: true,
    run: {
      game,
      board,
      room: room.code,
      name: named.name,
      nameKey: nameKey(named.name),
      classId,
      timeMs: Math.round(timeMs),
      kills,
      floor,
      level,
    },
  };
}

const CLOCK_SLACK_MS = 2500;
const MAX_STEP_MS = 20_000;
const FLOOR_MS = 9_000;

// No Light spawn credit is (0.9 + 0.035t + 0.25 per extra floor) * 1.5 per second.
// Integrated, then multiplied for the extra runner, mite, and husk-split spawns.
export function maxKillsForTime(timeMs, floor = 1) {
  const t = Math.max(0, Number(timeMs) / 1000);
  const depth = Math.max(0, Number(floor) - 1);
  const spawned = 1.5 * (0.9 * t + 0.0175 * t * t + 0.25 * depth * t);
  return Math.ceil(40 + spawned * 4);
}

export function maxKillStep(lastTMs, tMs, floor) {
  const crowd = 180 + Math.floor(Math.max(0, tMs) / 1000 / 5);
  return crowd + Math.max(0, maxKillsForTime(tMs, floor) - maxKillsForTime(lastTMs, floor));
}

export function maxFloorForTime(timeMs) {
  return 1 + Math.floor(Math.max(0, timeMs) / FLOOR_MS);
}

export function maxLevelForKills(kills) {
  let xp = Math.max(0, kills) * 12;
  let level = 1;
  while (level < 40) {
    const need = Math.floor(6 * Math.pow(level, 1.32));
    if (xp < need) break;
    xp -= need;
    level += 1;
  }
  return level;
}

export function maxLevelForTime(timeMs, kills) {
  return Math.min(40, maxLevelForKills(kills), 1 + Math.floor(kills / 4) + Math.floor(timeMs / 15000));
}

export function pingOk({
  startedAt,
  now,
  lastTMs,
  lastPingAt,
  tMs,
  lastKills = 0,
  lastFloor = 1,
  lastLevel = 1,
  kills,
  floor,
  level,
}) {
  if (!Number.isFinite(tMs) || tMs < 0) return { ok: false, error: "time looks wrong" };
  if (tMs < lastTMs - 250) return { ok: false, error: "time went backwards" };
  if (tMs > now - startedAt + CLOCK_SLACK_MS) return { ok: false, error: "clock disagrees" };
  const sincePing = lastPingAt == null ? MAX_STEP_MS : Math.max(0, now - lastPingAt) + CLOCK_SLACK_MS;
  if (tMs > lastTMs + Math.min(MAX_STEP_MS, sincePing)) return { ok: false, error: "clock jumped" };

  if (kills == null && floor == null && level == null) return { ok: true };
  if (!Number.isInteger(kills) || kills < lastKills) return { ok: false, error: "kills look wrong" };
  if (!Number.isInteger(floor) || floor < lastFloor) return { ok: false, error: "floor looks wrong" };
  if (!Number.isInteger(level) || level < lastLevel) return { ok: false, error: "lantern level looks wrong" };
  if (kills > maxKillsForTime(tMs, floor)) return { ok: false, error: "kills look wrong" };
  if (floor > maxFloorForTime(tMs)) return { ok: false, error: "floor looks wrong" };
  if (level > maxLevelForTime(tMs, kills)) return { ok: false, error: "lantern level looks wrong" };

  const catchingUp = lastKills === 0 && lastFloor === 1 && lastLevel === 1 && lastTMs > 0;
  const maxKills = catchingUp ? maxKillsForTime(tMs, floor) : lastKills + maxKillStep(lastTMs, tMs, floor);
  if (kills > maxKills) return { ok: false, error: "kills look wrong" };
  return { ok: true, kills, floor, level, tMs: Math.round(tMs) };
}

export function sessionSubmitOk({ startedAt, now, lastTMs, lastPingAt, pingN, timeMs, submitted }) {
  if (submitted) return { ok: false, error: "already signed" };
  if (now - startedAt > MAX_TIME_MS + 60_000) return { ok: false, error: "session expired" };
  if (timeMs > now - startedAt + CLOCK_SLACK_MS) return { ok: false, error: "clock disagrees" };
  if (timeMs + 500 < lastTMs) return { ok: false, error: "clock disagrees" };
  const minPings = timeMs < 20_000 ? 1 : 1 + Math.floor(timeMs / 50_000);
  if (pingN < minPings) return { ok: false, error: "run went quiet" };
  if (timeMs >= 20_000 && now - lastPingAt > 25_000) return { ok: false, error: "run went quiet" };
  return { ok: true };
}
