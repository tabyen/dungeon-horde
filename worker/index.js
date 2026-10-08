import {
  BOARDS,
  CLASS_IDS,
  formatRoomCode,
  GAME_ID,
  newRoomCode,
  parseName,
  parseRoomCode,
  parseReport,
  parseRun,
  pingOk,
  sessionSubmitOk,
} from "../js/validate.js";

const MAX_BODY = 8000;
const LIST_LIMIT = 25;

function json(req, data, status = 200) {
  const origin = req.headers.get("Origin");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (origin && allowOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "Content-Type";
    headers["access-control-max-age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowOrigin(origin) {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "crawler.local") return true;
    if (u.hostname.endsWith(".workers.dev") || u.hostname.endsWith(".pages.dev")) return true;
    if (origin === "https://tabyen.github.io") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function clientIp(req) {
  return req.headers.get("CF-Connecting-IP") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return { ok: false, error: "too large", status: 413 };
  if (!text) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid json", status: 400 };
  }
}

async function rateOk(env, ip, kind, limit) {
  const bucket = `${kind}:${Math.floor(Date.now() / 60000)}`;
  const row = await env.DB.prepare(
    `INSERT INTO rate (ip, bucket, n) VALUES (?, ?, 1)
     ON CONFLICT(ip, bucket) DO UPDATE SET n = n + 1
     RETURNING n`
  )
    .bind(ip, bucket)
    .first();
  if (Number(bucket.split(":")[1]) % 10 === 0) {
    await env.DB.prepare("DELETE FROM rate WHERE bucket LIKE ?").bind(`%:${Number(bucket.split(":")[1]) - 120}`).run();
  }
  return (row?.n || 1) <= limit;
}

async function listRuns(env, { board, room, nameKey, timeMs }) {
  const entries = (
    await env.DB.prepare(
      `SELECT name, time_ms AS timeMs, kills, floor, class_id AS classId, level, created_at AS createdAt
       FROM runs
       WHERE game = ? AND board = ? AND room = ?
       ORDER BY time_ms DESC, created_at DESC
       LIMIT ?`
    )
      .bind(GAME_ID, board, room, LIST_LIMIT)
      .all()
  ).results;

  let you = null;
  if (nameKey) {
    const mine = await env.DB.prepare(
      `SELECT name, time_ms AS timeMs, kills, floor, class_id AS classId, level
       FROM runs WHERE game = ? AND board = ? AND room = ? AND name_key = ?
       ORDER BY time_ms DESC, created_at DESC LIMIT 1`
    )
      .bind(GAME_ID, board, room, nameKey)
      .first();
    if (mine) {
      const stamp = Number.isFinite(timeMs) ? timeMs : mine.timeMs;
      const rankRow = await env.DB.prepare(
        `SELECT 1 + COUNT(*) AS rank FROM runs
         WHERE game = ? AND board = ? AND room = ? AND time_ms > ?`
      )
        .bind(GAME_ID, board, room, stamp)
        .first();
      you = { ...mine, timeMs: stamp, rank: rankRow?.rank || 1 };
    }
  }
  return { entries, you };
}

async function handleLeaderboard(req, env, url) {
  const board = url.searchParams.get("board") || "candle";
  if (!BOARDS.includes(board)) return json(req, { error: "unknown light" }, 400);
  const room = parseRoomCode(url.searchParams.get("room"));
  if (!room.ok) return json(req, { error: room.error }, 400);
  const named = url.searchParams.get("name") ? parseName(url.searchParams.get("name")) : { ok: true, name: "" };
  if (!named.ok) return json(req, { error: named.error }, 400);
  const data = await listRuns(env, {
    board,
    room: room.code,
    nameKey: named.name ? named.name.toLocaleLowerCase() : "",
  });
  return json(req, { ok: true, game: GAME_ID, board, room: formatRoomCode(room.code), ...data });
}

async function handleSession(req, env) {
  if (!(await rateOk(env, clientIp(req), "session", 8))) return json(req, { error: "slow down" }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json(req, { error: parsed.error }, parsed.status);
  const board = BOARDS.includes(parsed.body.board) ? parsed.body.board : null;
  const classId = CLASS_IDS.includes(parsed.body.classId) ? parsed.body.classId : null;
  if (parsed.body.game !== GAME_ID || !board || !classId) return json(req, { error: "unknown run" }, 400);
  const now = Date.now();
  await env.DB.prepare("DELETE FROM sessions WHERE started_at < ?").bind(now - 8 * 60 * 60 * 1000).run();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sessions (id, game, board, class_id, started_at, last_ping_at, last_t_ms, ping_n, submitted)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0)`
  )
    .bind(id, GAME_ID, board, classId, now, now)
    .run();
  return json(req, { ok: true, id });
}

async function handlePing(req, env) {
  if (!(await rateOk(env, clientIp(req), "ping", 40))) return json(req, { error: "slow down" }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json(req, { error: parsed.error }, parsed.status);
  const id = String(parsed.body.id || "");
  const tMs = Math.round(Number(parsed.body.tMs));
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first();
  if (!row || row.submitted) return json(req, { error: "no such run" }, 404);
  const now = Date.now();
  const check = pingOk({ startedAt: row.started_at, now, lastTMs: row.last_t_ms, tMs });
  if (!check.ok) return json(req, { error: check.error }, 400);
  await env.DB.prepare("UPDATE sessions SET last_ping_at = ?, last_t_ms = ?, ping_n = ping_n + 1 WHERE id = ?")
    .bind(now, tMs, id)
    .run();
  return json(req, { ok: true });
}

async function handleSubmit(req, env) {
  if (!(await rateOk(env, clientIp(req), "run", 8))) return json(req, { error: "slow down" }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json(req, { error: parsed.error }, parsed.status);
  const sessionId = String(parsed.body.sessionId || "");
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(sessionId).first();
  if (!session) return json(req, { error: "no such run" }, 404);
  const check = parseRun(parsed.body);
  if (!check.ok) return json(req, { error: check.error }, 400);
  const r = check.run;
  if (r.board !== session.board || r.classId !== session.class_id) return json(req, { error: "run does not match" }, 400);
  const now = Date.now();
  const clock = sessionSubmitOk({
    startedAt: session.started_at,
    now,
    lastTMs: session.last_t_ms,
    lastPingAt: session.last_ping_at,
    pingN: session.ping_n,
    timeMs: r.timeMs,
    submitted: session.submitted,
  });
  if (!clock.ok) return json(req, { error: clock.error }, 400);
  if (r.room) {
    const roomRow = await env.DB.prepare("SELECT code FROM rooms WHERE code = ? AND game = ?").bind(r.room, GAME_ID).first();
    if (!roomRow) return json(req, { error: "no such room" }, 404);
  }
  const prevBest = await env.DB.prepare(
    `SELECT MAX(time_ms) AS best FROM runs WHERE game = ? AND board = ? AND room = ? AND name_key = ?`
  )
    .bind(r.game, r.board, r.room, r.nameKey)
    .first();
  await env.DB.prepare(
    `INSERT INTO runs (game, board, room, name_key, name, time_ms, kills, floor, class_id, level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(r.game, r.board, r.room, r.nameKey, r.name, r.timeMs, r.kills, r.floor, r.classId, r.level, now)
    .run();
  await env.DB.prepare(
    `DELETE FROM runs
     WHERE game = ? AND board = ? AND room = ? AND name_key = ?
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM runs
           WHERE game = ? AND board = ? AND room = ? AND name_key = ?
           ORDER BY time_ms DESC, created_at DESC
           LIMIT 5
         )
       )`
  )
    .bind(r.game, r.board, r.room, r.nameKey, r.game, r.board, r.room, r.nameKey)
    .run();

  await env.DB.prepare("UPDATE sessions SET submitted = 1, last_t_ms = ?, last_ping_at = ? WHERE id = ?")
    .bind(r.timeMs, now, sessionId)
    .run();

  const improved = !prevBest?.best || r.timeMs > prevBest.best;
  const data = await listRuns(env, { board: r.board, room: r.room, nameKey: r.nameKey, timeMs: r.timeMs });
  return json(req, { ok: true, accepted: true, improved, ...data });
}

async function handleRoom(req, env) {
  if (!(await rateOk(env, clientIp(req), "room", 8))) return json(req, { error: "slow down" }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json(req, { error: parsed.error }, parsed.status);
  const game = parsed.body.game || GAME_ID;
  if (game !== GAME_ID) return json(req, { error: "unknown game" }, 400);

  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = newRoomCode(bytes);
    try {
      await env.DB.prepare("INSERT INTO rooms (code, game, created_at) VALUES (?, ?, ?)").bind(code, GAME_ID, Date.now()).run();
      return json(req, { ok: true, code, display: formatRoomCode(code) });
    } catch {
      /* unique collision — try again */
    }
  }
  return json(req, { error: "could not make a room" }, 500);
}

async function handleReport(req, env) {
  if (!(await rateOk(env, clientIp(req), "report", 8))) return json(req, { error: "slow down" }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json(req, { error: parsed.error }, parsed.status);
  const check = parseReport(parsed.body);
  if (!check.ok) return json(req, { error: check.error }, 400);
  const r = check.report;
  await env.DB.prepare(
    `INSERT INTO reports (game, board, room, name, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(r.game, r.board, r.room, r.name, r.note, Date.now())
    .run();
  return json(req, { ok: true });
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const pageStyle = `body{margin:0;background:#0c0908;color:#e8dcc8;font:18px Palatino,Georgia,serif}main{max-width:40rem;margin:0 auto;padding:32px 20px 64px}a{color:#c9a35a}h1{font-size:32px}`;

const privacyPage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Crawler — Privacy</title>
    <style>${pageStyle}</style>
  </head>
  <body>
    <main>
      <h1>Privacy</h1>
      <p>Crawler can be played without an account. There are no ads and no analytics tools.</p>
      <p>The game keeps a name, a room code, a difficulty, and a best run on this device. That stays on the device.</p>
      <p>If you sign the wall, the game sends your name, class, difficulty, floor, kills, level, and how long the run lasted to the Crawler server. The server also stores the IP address long enough to slow down repeated requests. Names on the wall can be seen by other players in the same room, or on the public wall if you leave the room blank.</p>
      <p>If you report a name, the game sends that name, the difficulty, the room code, and an optional note. Reports are not shown to other players.</p>
      <p>The paid store copies do not send payment details to the Crawler server. Apple, Google, and Steam handle the purchase.</p>
      <p>Questions and name-removal requests go to the <a href="/support">support page</a>.</p>
    </main>
  </body>
</html>
`;

const supportPage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Crawler — Support</title>
    <style>${pageStyle}</style>
  </head>
  <body>
    <main>
      <h1>Support</h1>
      <p>To report a name on the wall, open the wall in the game and use “Report this name.”</p>
      <p>For anything else, open an issue at <a href="https://github.com/tabyen/dungeon-horde/issues">github.com/tabyen/dungeon-horde</a>.</p>
      <p><a href="/privacy">Privacy</a></p>
    </main>
  </body>
</html>
`;

function pageResponse(html) {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withPageHeaders(res) {
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return json(req, { ok: true });
      try {
        if (url.pathname === "/api/health" && req.method === "GET") {
          return json(req, { ok: true, game: GAME_ID });
        }
        if (!env.DB) return json(req, { error: "board is not bound" }, 503);
        if (url.pathname === "/api/leaderboard" && req.method === "GET") return handleLeaderboard(req, env, url);
        if (url.pathname === "/api/sessions" && req.method === "POST") return handleSession(req, env);
        if (url.pathname === "/api/sessions/ping" && req.method === "POST") return handlePing(req, env);
        if (url.pathname === "/api/runs" && req.method === "POST") return handleSubmit(req, env);
        if (url.pathname === "/api/rooms" && req.method === "POST") return handleRoom(req, env);
        if (url.pathname === "/api/reports" && req.method === "POST") return handleReport(req, env);
        return json(req, { error: "not found" }, 404);
      } catch (err) {
        return json(req, { error: "the wall cracked", detail: String(err?.message || err) }, 500);
      }
    }
    if (url.pathname === "/privacy" || url.pathname === "/privacy.html") {
      return withPageHeaders(pageResponse(privacyPage));
    }
    if (url.pathname === "/support" || url.pathname === "/support.html") {
      return withPageHeaders(pageResponse(supportPage));
    }
    if (!env.ASSETS) return new Response("not found", { status: 404 });
    return withPageHeaders(await env.ASSETS.fetch(req));
  },
};
