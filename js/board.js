import { BOARDS, formatRoomCode, parseName, parseRoomCode } from "./validate.js";

const NAME_KEY = "crawler-name";
const ROOM_KEY = "crawler-room";
const GAME = "dungeon-horde";
const PUBLIC_ORIGIN = "https://crawler.tabyen.workers.dev";

export function apiBase() {
  const { hostname, port, protocol } = location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (port === "8787" || port === "8788" || port === "") return "";
    return `${protocol}//${hostname}:8787`;
  }
  if (hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev")) return "";
  if (typeof window !== "undefined" && window.__CRAWLER_API) return String(window.__CRAWLER_API).replace(/\/$/, "");
  return "";
}

export function savedName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function savedRoom() {
  return localStorage.getItem(ROOM_KEY) || "";
}

function setSavedName(name) {
  if (name) localStorage.setItem(NAME_KEY, name);
  else localStorage.removeItem(NAME_KEY);
}

function setSavedRoom(code) {
  if (code) localStorage.setItem(ROOM_KEY, code);
  else localStorage.removeItem(ROOM_KEY);
}

export async function api(path, opts) {
  const res = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
    ...opts,
    headers: { ...(opts && opts.headers), ...(opts && opts.body ? { "content-type": "application/json" } : {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `board ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function rowHtml(entry, i, className, boardId) {
  const extra = [className(entry.classId), `floor ${entry.floor}`, `${entry.kills} slain`].filter(Boolean).join(" · ");
  const m = Math.floor(entry.timeMs / 60000);
  const s = Math.floor((entry.timeMs / 1000) % 60);
  const time = `${m}:${s.toString().padStart(2, "0")}`;
  return `<li>
    <span class="rank">${i + 1}</span>
    <span class="who">${escapeHtml(entry.name)}<small>${escapeHtml(extra)}</small>
      <button type="button" class="report" data-name="${escapeHtml(entry.name)}" data-board="${escapeHtml(boardId || "")}">Report this name</button>
    </span>
    <span class="time">${time}</span>
  </li>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function status(el, msg) {
  if (el) el.textContent = msg || "";
}

export function bindBoard({ getDifficulty, className }) {
  const overlay = document.getElementById("board");
  const nameInput = document.getElementById("board-name");
  const roomInput = document.getElementById("board-room");
  const list = document.getElementById("board-list");
  const statusEl = document.getElementById("board-status");
  const tabs = document.getElementById("board-tabs");
  const deadList = document.getElementById("dead-board");
  const deadPlace = document.getElementById("dead-place");
  const deadName = document.getElementById("dead-name");
  const deadSubmit = document.getElementById("btn-dead-submit");
  const boardSubmit = document.getElementById("btn-board-submit");
  let board = getDifficulty() || "candle";
  let cameFrom = "title";
  let pending = null;
  let signed = false;

  const params = new URLSearchParams(location.search);
  if (params.get("room")) setSavedRoom(parseRoomCode(params.get("room")).code || params.get("room"));

  nameInput.value = savedName();
  if (deadName) deadName.value = savedName();
  roomInput.value = formatRoomCode(savedRoom());

  function syncName(from) {
    const v = from.value;
    if (nameInput !== from) nameInput.value = v;
    if (deadName && deadName !== from) deadName.value = v;
  }

  function paintSubmit() {
    const ready = Boolean(pending) && !signed;
    for (const btn of [deadSubmit, boardSubmit]) {
      if (!btn) continue;
      btn.disabled = !ready;
      btn.textContent = signed ? "Signed" : "Sign the wall";
    }
  }
  paintSubmit();

  function persistFields() {
    const named = parseName(nameInput.value);
    if (named.ok) setSavedName(named.name);
    const room = parseRoomCode(roomInput.value);
    if (room.ok) {
      setSavedRoom(room.code);
      roomInput.value = formatRoomCode(room.code);
    }
  }

  function paintTabs() {
    tabs.querySelectorAll("button").forEach((btn) => btn.classList.toggle("on", btn.dataset.board === board));
  }

  async function refresh(targetList = list) {
    persistFields();
    paintTabs();
    const room = parseRoomCode(roomInput.value);
    const named = parseName(nameInput.value);
    const q = new URLSearchParams({ game: GAME, board, room: room.ok ? room.code : "" });
    if (named.ok) q.set("name", named.name);
    try {
      const data = await api(`/api/leaderboard?${q}`);
      if (!data.entries.length) {
        targetList.innerHTML = "";
        status(statusEl, room.code ? "No names in this room yet." : "No names on this wall yet.");
      } else {
        targetList.innerHTML = data.entries.map((e, i) => rowHtml(e, i, className, board)).join("");
        status(statusEl, data.room ? `Room ${data.room}` : "The public wall");
      }
      return data;
    } catch {
      targetList.innerHTML = "";
      status(statusEl, "The wall is quiet. Scores stay on this lantern.");
      return null;
    }
  }

  async function onDeath(rec) {
    pending = rec;
    signed = false;
    board = rec.difficulty || board;
    paintTabs();
    paintSubmit();
    if (deadName && !deadName.value) deadName.value = savedName();
    if (deadPlace) deadPlace.textContent = rec.sessionId ? "Sign the wall to be remembered." : "This night will not be taken.";
    refresh(deadList);
  }

  async function submitPending() {
    if (!pending || signed) return;
    if (deadName && deadName.value) syncName(deadName);
    else syncName(nameInput);
    persistFields();
    const named = parseName(nameInput.value || savedName());
    if (!named.ok) {
      if (deadPlace) deadPlace.textContent = named.error || "Give a name to sign.";
      status(statusEl, "Give a name to sign.");
      (deadName || nameInput).focus();
      return;
    }
    setSavedName(named.name);
    syncName(nameInput);
    const room = parseRoomCode(roomInput.value || savedRoom());
    const rec = pending;
    if (!rec.sessionId) {
      if (deadPlace) deadPlace.textContent = "This night will not be taken.";
      status(statusEl, "This night will not be taken.");
      return;
    }
    deadSubmit && (deadSubmit.disabled = true);
    boardSubmit && (boardSubmit.disabled = true);
    try {
      await pingSession(rec.sessionId, Math.round(rec.time * 1000)).catch(() => {});
      const data = await api("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          game: GAME,
          sessionId: rec.sessionId,
          board: rec.difficulty,
          room: room.ok ? room.code : "",
          name: named.name,
          classId: rec.classId,
          timeMs: Math.round(rec.time * 1000),
          kills: rec.kills,
          floor: rec.floor,
          level: rec.level,
        }),
      });
      signed = true;
      pending = null;
      paintSubmit();
      if (deadList) deadList.innerHTML = (data.entries || []).slice(0, 8).map((e, i) => rowHtml(e, i, className, rec.difficulty)).join("");
      if (list) list.innerHTML = (data.entries || []).map((e, i) => rowHtml(e, i, className, rec.difficulty)).join("");
      const note =
        data.you && data.you.rank
          ? `#${data.you.rank} · ${data.improved ? "a longer lantern" : "another night on the wall"}`
          : "The wall took the name.";
      if (deadPlace) deadPlace.textContent = note;
      status(statusEl, note);
    } catch (err) {
      paintSubmit();
      const msg = err.status === 404 ? "That room is gone." : "The wall did not take the name.";
      if (deadPlace) deadPlace.textContent = msg;
      status(statusEl, msg);
      refresh(deadList);
    }
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-board]");
    if (!btn) return;
    board = btn.dataset.board;
    refresh();
  });
  nameInput.addEventListener("input", () => syncName(nameInput));
  nameInput.addEventListener("change", () => {
    persistFields();
    refresh();
  });
  if (deadName) {
    deadName.addEventListener("input", () => syncName(deadName));
    deadName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitPending();
      }
    });
  }
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPending();
    }
  });
  deadSubmit?.addEventListener("click", () => submitPending());
  boardSubmit?.addEventListener("click", () => submitPending());

  async function reportName(name, boardId) {
    const room = parseRoomCode(roomInput.value);
    try {
      await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          game: GAME,
          board: boardId || board,
          room: room.ok ? room.code : "",
          name,
        }),
      });
      status(statusEl, "That name was reported.");
      if (deadPlace) deadPlace.textContent = "That name was reported.";
    } catch {
      status(statusEl, "The wall is quiet. Scores stay on this lantern.");
    }
  }

  function onReportClick(e) {
    const btn = e.target.closest("button.report");
    if (!btn) return;
    reportName(btn.dataset.name, btn.dataset.board);
  }
  list.addEventListener("click", onReportClick);
  deadList?.addEventListener("click", onReportClick);
  roomInput.addEventListener("change", () => {
    persistFields();
    refresh();
  });
  document.getElementById("btn-make-room").addEventListener("click", async () => {
    persistFields();
    try {
      const data = await api("/api/rooms", { method: "POST", body: JSON.stringify({ game: GAME }) });
      roomInput.value = data.display || formatRoomCode(data.code);
      setSavedRoom(data.code);
      const share = `${PUBLIC_ORIGIN}/?room=${data.code}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(`${data.display} ${share}`);
        copied = true;
      } catch {
        copied = false;
      }
      status(statusEl, copied ? `Copied ${data.display}. ${share}` : `Give this to friends: ${data.display}. ${share}`);
      refresh();
    } catch {
      status(statusEl, "Could not make a room.");
    }
  });

  return {
    overlay,
    cameFrom() {
      return cameFrom;
    },
    openFrom(mode) {
      cameFrom = mode === "dead" ? "dead" : "title";
      board = getDifficulty() || board;
      if (!BOARDS.includes(board)) board = "candle";
      nameInput.value = savedName();
      roomInput.value = formatRoomCode(savedRoom());
      refresh();
    },
    refresh,
    onDeath,
    clearPending() {
      pending = null;
      signed = false;
      paintSubmit();
    },
    pickTab(id) {
      if (!BOARDS.includes(id)) return;
      board = id;
      refresh();
    },
  };
}

export async function startSession({ board, classId }) {
  const data = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ game: GAME, board, classId }),
  });
  return data.id;
}

export async function pingSession(id, tMs) {
  await api("/api/sessions/ping", {
    method: "POST",
    body: JSON.stringify({ id, tMs }),
  });
}
