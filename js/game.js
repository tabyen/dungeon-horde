import { TILE, TILE_WALL, TILE_STAIRS, generateDungeon } from "./map.js";
import { createAudio } from "./audio.js";

const TAU = Math.PI * 2;
const BEST_KEY = "crawler-best";
const DIFF_KEY = "crawler-difficulty";

const DIFFICULTIES = {
  candle: {
    id: "candle",
    name: "Candle",
    playerHp: 1.4,
    playerDmg: 1.2,
    enemyHp: 0.7,
    enemyDmg: 0.6,
    enemySpeed: 0.82,
    spawn: 0.5,
    ramp: 0.55,
    eliteDelay: 1.7,
    enemyCap: 70,
    startEnemies: 1,
    vialHeal: 28,
    stairHeal: 0.35,
    xpMul: 1.25,
    extraRunner: 0.06,
    extraRunnerAt: 95,
    iframes: 0.9,
    pickups: 7,
  },
  lantern: {
    id: "lantern",
    name: "Lantern",
    playerHp: 1,
    playerDmg: 1,
    enemyHp: 1,
    enemyDmg: 1,
    enemySpeed: 1,
    spawn: 1,
    ramp: 1,
    eliteDelay: 1,
    enemyCap: 110,
    startEnemies: 2,
    vialHeal: 18,
    stairHeal: 0.2,
    xpMul: 1,
    extraRunner: 0.15,
    extraRunnerAt: 70,
    iframes: 0.7,
    pickups: 5,
  },
  black: {
    id: "black",
    name: "No Light",
    playerHp: 0.85,
    playerDmg: 0.92,
    enemyHp: 1.4,
    enemyDmg: 1.4,
    enemySpeed: 1.18,
    spawn: 1.5,
    ramp: 1.45,
    eliteDelay: 0.55,
    enemyCap: 140,
    startEnemies: 4,
    vialHeal: 12,
    stairHeal: 0.1,
    xpMul: 0.85,
    extraRunner: 0.28,
    extraRunnerAt: 40,
    iframes: 0.55,
    pickups: 3,
  },
};

const CLASSES = {
  rogue: {
    name: "Rogue",
    hp: 90,
    speed: 168,
    r: 11,
    color: "#6e6258",
    accent: "#d8c4a4",
    weapon: "knives",
    cooldown: 0.36,
    damage: 9,
    projectiles: 1,
  },
  warrior: {
    name: "Warrior",
    hp: 150,
    speed: 122,
    r: 13,
    color: "#6a5844",
    accent: "#c9b089",
    weapon: "orbit",
    cooldown: 0.42,
    damage: 13,
    projectiles: 1,
    armor: 0.1,
  },
  wizard: {
    name: "Wizard",
    hp: 70,
    speed: 138,
    r: 11,
    color: "#4a3a58",
    accent: "#9b74c4",
    weapon: "missile",
    cooldown: 0.7,
    damage: 16,
    projectiles: 1,
  },
};

const ENEMY_KINDS = {
  crawler: { hp: 18, speed: 46, r: 10, xp: 1, damage: 8, color: "#4e5a32", eyes: "#c4d46a" },
  runner: { hp: 10, speed: 98, r: 8, xp: 2, damage: 6, color: "#7a3e28", eyes: "#f0c070" },
  brute: { hp: 58, speed: 30, r: 16, xp: 5, damage: 16, color: "#3a322c", eyes: "#e07040" },
  watcher: { hp: 30, speed: 118, r: 12, xp: 6, damage: 14, color: "#2e2438", eyes: "#d080ff" },
};

const UPGRADES = [
  { id: "damage", name: "Sharper", desc: "Wounds open wider. +25% damage." },
  { id: "haste", name: "Faster Hands", desc: "The work comes quicker. +18% attack speed." },
  { id: "boots", name: "Quiet Boots", desc: "The floor complains less. +14% move speed." },
  { id: "vital", name: "Second Wind", desc: "+25 max HP. A little of it now." },
  { id: "magnet", name: "Greedy", desc: "Light pulls the remnants closer." },
  { id: "pierce", name: "Through", desc: "Projectiles pass through one more body." },
  { id: "multi", name: "Another", desc: "One more knife, blade, or mote." },
  { id: "area", name: "Reach", desc: "Attacks travel farther. Orbits widen." },
  { id: "regen", name: "Slow Close", desc: "Wounds remember how to shut. +1 HP/s." },
  { id: "armor", name: "Hide", desc: "The dark takes a smaller bite. +15% resist." },
  { id: "light", name: "Brighter Lantern", desc: "See farther. The light itself stings." },
];

const NOTES = [
  "The walls remember names. I've stopped reading them.",
  "It follows sound. I've learned to hold my breath.",
  "Level 3. The lights here aren't lanterns.",
  "I found a room that wasn't on my map. It was on the map when I left.",
  "Do not eat the blue fungi. Do not eat the blue fungi. Do not eat the—",
  "Seven days below. My compass points down now.",
  "Someone has been here recently. The torch was still warm.",
  "The scratches on this door spell a word in a language I do not know.",
  "Left my mark at every junction. Someone has been erasing them.",
  "It didn't attack me. It just watched. That's worse.",
  "There is a room at the bottom. I've been told not to open it.",
  "The bones here are arranged too carefully to be accidental.",
];

const audio = createAudio();
const keys = new Set();
const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let W = 0;
let H = 0;

const ui = {
  hud: document.getElementById("hud"),
  title: document.getElementById("title"),
  select: document.getElementById("select"),
  difficulty: document.getElementById("difficulty"),
  levelup: document.getElementById("levelup"),
  pause: document.getElementById("pause"),
  dead: document.getElementById("dead"),
  note: document.getElementById("note"),
  floor: document.getElementById("floor"),
  timer: document.getElementById("timer"),
  kills: document.getElementById("kills"),
  xp: document.getElementById("xp"),
  hpfill: document.getElementById("hpfill"),
  hptext: document.getElementById("hptext"),
  log: document.getElementById("log"),
  choices: document.getElementById("choices"),
  deadStats: document.getElementById("dead-stats"),
  deadBest: document.getElementById("dead-best"),
  hint: document.getElementById("hint"),
  pauseBtn: document.getElementById("btn-pause"),
  stick: document.getElementById("stick"),
  knob: document.getElementById("stick-knob"),
  muteBtn: document.getElementById("btn-mute"),
  titleFine: document.getElementById("title-fine"),
  selectFine: document.getElementById("select-fine"),
  levelFine: document.getElementById("level-fine"),
};

const G = {
  mode: "title",
  classId: "rogue",
  difficulty: "lantern",
  t: 0,
  floor: 1,
  kills: 0,
  spawnCredit: 0,
  nextId: 1,
  player: null,
  enemies: [],
  bullets: [],
  gems: [],
  particles: [],
  floaters: [],
  pickups: [],
  map: null,
  camX: 0,
  camY: 0,
  shake: 0,
  log: [],
  noteT: 0,
  usedNotes: [],
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vv = window.visualViewport;
  W = Math.max(1, (vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || 1280);
  H = Math.max(1, (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 800);
  const bw = Math.floor(W * dpr);
  const bh = Math.floor(H * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function isCoarse() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

function refreshChrome() {
  document.body.classList.toggle("coarse", isCoarse());
  if (ui.muteBtn) ui.muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
}

function endStick() {
  stick.active = false;
  stick.id = null;
  stick.dx = 0;
  stick.dy = 0;
  if (ui.knob) ui.knob.style.transform = "";
  hide(ui.stick);
}

function D() {
  return DIFFICULTIES[G.difficulty] || DIFFICULTIES.lantern;
}

function markLastDifficulty() {
  const last = localStorage.getItem(DIFF_KEY) || "lantern";
  document.querySelectorAll(".diff-card").forEach((btn) => {
    btn.classList.toggle("last-pick", btn.dataset.diff === last);
  });
}

function setMode(mode) {
  G.mode = mode;
  if (mode !== "play") endStick();
  hide(ui.title);
  hide(ui.select);
  hide(ui.difficulty);
  hide(ui.levelup);
  hide(ui.pause);
  hide(ui.dead);
  hide(ui.pauseBtn);
  if (mode === "title") {
    hide(ui.hud);
    show(ui.title);
  } else if (mode === "select") {
    hide(ui.hud);
    show(ui.select);
  } else if (mode === "difficulty") {
    hide(ui.hud);
    markLastDifficulty();
    show(ui.difficulty);
  } else if (mode === "play") {
    show(ui.hud);
    show(ui.pauseBtn);
  } else if (mode === "levelup") {
    show(ui.hud);
    show(ui.levelup);
  } else if (mode === "pause") {
    show(ui.hud);
    show(ui.pause);
    if (ui.muteBtn) ui.muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
  } else if (mode === "dead") {
    show(ui.hud);
    show(ui.dead);
  }
}

function log(msg) {
  G.log.unshift(msg);
  if (G.log.length > 4) G.log.pop();
  ui.log.innerHTML = G.log.map((line) => `<div>${line}</div>`).join("");
}

function showNote(text) {
  ui.note.textContent = text;
  show(ui.note);
  G.noteT = 4.2;
}

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function len(x, y) {
  return Math.hypot(x, y) || 1;
}

function startRun(classId, difficulty) {
  G.classId = classId;
  G.difficulty = DIFFICULTIES[difficulty] ? difficulty : G.difficulty || "lantern";
  localStorage.setItem(DIFF_KEY, G.difficulty);
  G.t = 0;
  G.floor = 1;
  G.kills = 0;
  G.spawnCredit = 0;
  G.nextId = 1;
  G.log = [];
  ui.log.innerHTML = "";
  const spec = CLASSES[classId];
  const d = D();
  const hp = Math.round(spec.hp * d.playerHp);
  G.player = {
    classId,
    x: 0,
    y: 0,
    r: spec.r,
    hp,
    maxHp: hp,
    speed: spec.speed,
    color: spec.color,
    accent: spec.accent,
    weapon: spec.weapon,
    cooldown: spec.cooldown,
    cd: 0.15,
    damage: spec.damage * d.playerDmg,
    dmgMul: 1,
    atkSpd: 1,
    projectiles: spec.projectiles,
    pierce: 0,
    area: 1,
    magnet: 48,
    regen: 0,
    armor: spec.armor || 0,
    light: 260,
    lightDmg: 0,
    facing: 0,
    moving: false,
    iframes: 0,
    xp: 0,
    xpNeed: 6,
    level: 1,
    orbitAngle: 0,
    orbitHits: new Map(),
    pendingLevels: 0,
  };
  buildFloor(true);
  setMode("play");
  log(`${d.name}. You descend into the dark.`);
  audio.descend();
  resize();
  snapCamera();
  updateHud();
  render();
}

function buildFloor(first) {
  G.map = generateDungeon();
  const spawn = G.map.spawn;
  G.player.x = G.map.worldX(spawn.x);
  G.player.y = G.map.worldY(spawn.y);
  snapCamera();
  G.enemies = [];
  G.bullets = [];
  G.gems = [];
  G.particles = [];
  G.floaters = [];
  G.pickups = [];
  const d = D();
  G.spawnCredit = first ? 0.25 * d.spawn : 1.2 * d.spawn;
  placePickups();
  const n = first ? d.startEnemies : d.startEnemies + 1;
  for (let i = 0; i < n; i++) spawnEnemy(i === 0 && !first ? "runner" : "crawler");
}

function placePickups() {
  const rooms = G.map.rooms.slice(1);
  const count = Math.min(D().pickups, rooms.length);
  for (let i = 0; i < count; i++) {
    const room = rooms[i];
    const tx = room.x + 1 + ((room.w - 2) * Math.random()) | 0;
    const ty = room.y + 1 + ((room.h - 2) * Math.random()) | 0;
    if (!G.map.isWalkable(tx, ty)) continue;
    const kind = i === 0 ? "note" : i % 2 === 0 ? "health" : "fuel";
    G.pickups.push({
      x: G.map.worldX(tx),
      y: G.map.worldY(ty),
      kind,
      r: 8,
    });
  }
}

function nextNote() {
  if (G.usedNotes.length >= NOTES.length) G.usedNotes = [];
  let pick;
  do {
    pick = NOTES[(Math.random() * NOTES.length) | 0];
  } while (G.usedNotes.includes(pick) && G.usedNotes.length < NOTES.length);
  G.usedNotes.push(pick);
  return pick;
}

function xpNeeded(level) {
  return Math.floor(6 * Math.pow(level, 1.32));
}

function gainXp(amount) {
  const p = G.player;
  p.xp += amount * D().xpMul;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level += 1;
    p.xpNeed = xpNeeded(p.level);
    p.pendingLevels += 1;
  }
  if (p.pendingLevels > 0 && G.mode === "play") openLevelUp();
}

function openLevelUp() {
  audio.level();
  const pool = UPGRADES.slice();
  const choices = [];
  while (choices.length < 3 && pool.length) {
    const i = (Math.random() * pool.length) | 0;
    choices.push(pool.splice(i, 1)[0]);
  }
  G.choices = choices;
  ui.choices.innerHTML = choices
    .map(
      (c, i) => `
      <button class="choice" type="button" data-i="${i}">
        <span class="key">${i + 1}</span>
        <h3>${c.name}</h3>
        <p>${c.desc}</p>
      </button>`
    )
    .join("");
  setMode("levelup");
}

function applyUpgrade(id) {
  const p = G.player;
  switch (id) {
    case "damage":
      p.dmgMul *= 1.25;
      break;
    case "haste":
      p.atkSpd *= 1.18;
      break;
    case "boots":
      p.speed *= 1.14;
      break;
    case "vital":
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
      break;
    case "magnet":
      p.magnet += 42;
      break;
    case "pierce":
      p.pierce += 1;
      break;
    case "multi":
      p.projectiles += 1;
      break;
    case "area":
      p.area *= 1.22;
      break;
    case "regen":
      p.regen += 1;
      break;
    case "armor":
      p.armor = Math.min(0.65, p.armor + 0.15);
      break;
    case "light":
      p.light += 70;
      p.lightDmg += 2.2;
      break;
  }
  p.pendingLevels = Math.max(0, p.pendingLevels - 1);
  if (p.pendingLevels > 0) openLevelUp();
  else setMode("play");
}

function pickSpawnTile() {
  const p = G.player;
  for (let i = 0; i < 24; i++) {
    const ang = Math.random() * TAU;
    const d = 320 + Math.random() * 220;
    const x = p.x + Math.cos(ang) * d;
    const y = p.y + Math.sin(ang) * d;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!G.map.isWalkable(tx, ty)) continue;
    if (Math.hypot(x - p.x, y - p.y) < 240) continue;
    return { x: G.map.worldX(tx), y: G.map.worldY(ty) };
  }
  const far = G.map.floors.filter((t) => {
    const dx = G.map.worldX(t.x) - p.x;
    const dy = G.map.worldY(t.y) - p.y;
    return dx * dx + dy * dy > 280 * 280;
  });
  const t = far.length ? far[(Math.random() * far.length) | 0] : G.map.floors[(Math.random() * G.map.floors.length) | 0];
  return { x: G.map.worldX(t.x), y: G.map.worldY(t.y) };
}

function enemyKindForTime(t) {
  const delay = D().eliteDelay;
  const roll = Math.random();
  if (t > 95 * delay && roll < 0.12) return "watcher";
  if (t > 55 * delay && roll < 0.22) return "brute";
  if (t > 22 * delay && roll < 0.42) return "runner";
  return "crawler";
}

function spawnEnemy(kind) {
  const d = D();
  if (G.enemies.length >= d.enemyCap) return;
  const spec = ENEMY_KINDS[kind];
  const pos = pickSpawnTile();
  const floorMul = 1 + (G.floor - 1) * 0.16;
  G.enemies.push({
    id: G.nextId++,
    kind,
    x: pos.x,
    y: pos.y,
    r: spec.r,
    hp: spec.hp * floorMul * d.enemyHp,
    maxHp: spec.hp * floorMul * d.enemyHp,
    speed: spec.speed * d.enemySpeed,
    damage: spec.damage * d.enemyDmg,
    xp: spec.xp,
    color: spec.color,
    eyes: spec.eyes,
    charged: kind !== "watcher",
    hitFlash: 0,
  });
}

function spawnBurst(x, y, color, n, speed = 80) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = speed * (0.3 + Math.random());
    G.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.25 + Math.random() * 0.35,
      max: 0.6,
      color,
      r: 1.5 + Math.random() * 2,
    });
  }
}

function floater(x, y, text, color) {
  G.floaters.push({ x, y, text, color, life: 0.7 });
}

function hurtEnemy(e, amount, fromX, fromY) {
  e.hp -= amount;
  e.hitFlash = 0.08;
  const kb = 28;
  const d = len(e.x - fromX, e.y - fromY);
  e.x += ((e.x - fromX) / d) * kb * 0.08;
  e.y += ((e.y - fromY) / d) * kb * 0.08;
  floater(e.x, e.y - e.r - 6, `${Math.round(amount)}`, "#f0d8a8");
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.kills += 1;
  G.gems.push({ x: e.x, y: e.y, v: e.xp, r: 4 + e.xp * 0.4, pull: false });
  spawnBurst(e.x, e.y, e.color, 10, 110);
  if (e.kind === "brute" && Math.random() < 0.28) {
    G.pickups.push({ x: e.x, y: e.y, kind: "health", r: 8 });
  }
  if (e.kind === "watcher" && Math.random() < 0.45) {
    G.pickups.push({ x: e.x, y: e.y, kind: "fuel", r: 8 });
  }
}

function nearestEnemies(n) {
  const p = G.player;
  return G.enemies
    .map((e) => ({ e, d: dist2(p, e) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.e);
}

function fireWeapons(dt) {
  const p = G.player;
  p.cd -= dt;
  if (p.weapon === "orbit") {
    p.orbitAngle += dt * (2.4 * p.atkSpd);
    const count = p.projectiles;
    const radius = 42 * p.area;
    const dmg = p.damage * p.dmgMul;
    for (let i = 0; i < count; i++) {
      const a = p.orbitAngle + (TAU * i) / count;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      for (const e of G.enemies) {
        if (Math.hypot(e.x - bx, e.y - by) < e.r + 8) {
          const last = p.orbitHits.get(e.id) || 0;
          if (G.t - last > 0.28 / p.atkSpd) {
            p.orbitHits.set(e.id, G.t);
            hurtEnemy(e, dmg, p.x, p.y);
            audio.hit();
          }
        }
      }
    }
    if (p.orbitHits.size > 80) {
      for (const id of p.orbitHits.keys()) {
        if (!G.enemies.some((e) => e.id === id)) p.orbitHits.delete(id);
      }
    }
    return;
  }

  if (p.cd > 0) return;
  const targets = nearestEnemies(p.projectiles);
  if (!targets.length) return;

  p.cd = p.cooldown / p.atkSpd;
  audio.shoot();

  if (p.weapon === "knives") {
    const aim = targets[0];
    const base = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.facing = base;
    const n = p.projectiles;
    const spread = 0.2;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      G.bullets.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 420,
        vy: Math.sin(a) * 420,
        r: 4,
        life: 0.7 * p.area,
        damage: p.damage * p.dmgMul,
        pierce: p.pierce,
        kind: "knife",
        hit: new Set(),
      });
    }
  } else {
    const n = p.projectiles;
    for (let i = 0; i < n; i++) {
      const t = targets[i % targets.length];
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      G.bullets.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 260,
        vy: Math.sin(a) * 260,
        r: 5,
        life: 1.4 * p.area,
        damage: p.damage * p.dmgMul,
        pierce: p.pierce,
        kind: "missile",
        hit: new Set(),
        targetId: t.id,
      });
    }
  }
}

function moveWithWalls(ent, dx, dy) {
  const nx = ent.x + dx;
  const ny = ent.y + dy;
  if (!G.map.circleHitsWall(nx, ny, ent.r)) {
    ent.x = nx;
    ent.y = ny;
    return;
  }
  if (!G.map.circleHitsWall(nx, ent.y, ent.r)) {
    ent.x = nx;
    return;
  }
  if (!G.map.circleHitsWall(ent.x, ny, ent.r)) {
    ent.y = ny;
  }
}

function updatePlayer(dt) {
  const p = G.player;
  let ax = 0;
  let ay = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) ay -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) ay += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ax -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ax += 1;
  const usingKeys = ax !== 0 || ay !== 0;
  if (stick.active) {
    ax += stick.dx;
    ay += stick.dy;
  }
  const mag = len(ax, ay);
  p.moving = mag > 0.01;
  if (p.moving) {
    const nx = ax / mag;
    const ny = ay / mag;
    const speed = usingKeys ? p.speed : p.speed * Math.min(1, mag);
    p.facing = Math.atan2(ny, nx);
    moveWithWalls(p, nx * speed * dt, ny * speed * dt);
  }
  if (p.iframes > 0) p.iframes -= dt;
  if (p.regen > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  const stair = G.map.stairs;
  if (Math.hypot(p.x - G.map.worldX(stair.x), p.y - G.map.worldY(stair.y)) < 18) {
    G.floor += 1;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * D().stairHeal);
    log("A staircase. You go deeper.");
    audio.descend();
    buildFloor(false);
  }
}

function updateEnemies(dt) {
  const p = G.player;
  const d = D();
  const timeMul = 1 + (G.t * 0.012 + (G.floor - 1) * 0.18) * d.ramp;
  G.spawnCredit += dt * (0.9 + G.t * 0.035 + (G.floor - 1) * 0.25) * d.spawn;
  while (G.spawnCredit >= 1) {
    G.spawnCredit -= 1;
    spawnEnemy(enemyKindForTime(G.t));
    if (G.t > d.extraRunnerAt && Math.random() < d.extraRunner) spawnEnemy("runner");
  }

  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i];
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.kind === "watcher" && !e.charged) {
      if (d < 170) e.charged = true;
      else continue;
    }
    const speed = e.speed * (e.kind === "watcher" ? 1.05 : 1) * Math.min(timeMul, 1.8);
    moveWithWalls(e, (dx / d) * speed * dt, (dy / d) * speed * dt);

    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (p.lightDmg > 0 && d < p.light * 0.28) {
      e.hp -= p.lightDmg * dt;
      if (e.hp <= 0) {
        killEnemy(e);
        continue;
      }
    }

    if (d < e.r + p.r - 1 && p.iframes <= 0 && G.mode === "play") {
      const dmg = e.damage * (1 - p.armor);
      p.hp -= dmg;
      p.iframes = D().iframes;
      G.shake = 8;
      audio.hurt();
      spawnBurst(p.x, p.y, "#c44a3a", 8, 90);
      const kb = 90;
      moveWithWalls(p, (-dx / d) * kb * dt * 8, (-dy / d) * kb * dt * 8);
      if (p.hp <= 0) {
        p.hp = 0;
        die();
        return;
      }
    }
  }

  G.enemies = G.enemies.filter((e) => !e.dead);

  for (let i = 0; i < G.enemies.length; i++) {
    for (let j = i + 1; j < G.enemies.length; j++) {
      const a = G.enemies[i];
      const b = G.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = a.r + b.r - 2;
      if (d < min) {
        const push = ((min - d) / 2) * 0.6;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    if (b.kind === "missile") {
      const target = G.enemies.find((e) => e.id === b.targetId) || nearestEnemies(1)[0];
      if (target) {
        const desired = Math.atan2(target.y - b.y, target.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const next = cur + diff * Math.min(1, 10 * dt);
        const spd = 280;
        b.vx = Math.cos(next) * spd;
        b.vy = Math.sin(next) * spd;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || G.map.circleHitsWall(b.x, b.y, 2)) {
      G.bullets.splice(i, 1);
      continue;
    }
    for (const e of G.enemies) {
      if (b.hit.has(e.id)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        b.hit.add(e.id);
        hurtEnemy(e, b.damage, b.x, b.y);
        audio.hit();
        spawnBurst(b.x, b.y, "#f0e0b0", 4, 70);
        if (b.hit.size > b.pierce) {
          G.bullets.splice(i, 1);
          break;
        }
      }
    }
  }
}

function updateGems(dt) {
  const p = G.player;
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i];
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < p.magnet) g.pull = true;
    if (g.pull) {
      const spd = 280 + (p.magnet - d);
      g.x += ((p.x - g.x) / (d || 1)) * spd * dt;
      g.y += ((p.y - g.y) / (d || 1)) * spd * dt;
    }
    if (d < p.r + 8) {
      gainXp(g.v);
      audio.gem();
      G.gems.splice(i, 1);
    }
  }
}

function updatePickups() {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const u = G.pickups[i];
    if (Math.hypot(u.x - p.x, u.y - p.y) > p.r + u.r + 4) continue;
    G.pickups.splice(i, 1);
    audio.pickup();
    if (u.kind === "health") {
      p.hp = Math.min(p.maxHp, p.hp + D().vialHeal);
      log("A vial. The wound remembers less.");
    } else if (u.kind === "fuel") {
      p.light += 40;
      log("Lantern oil. The dark steps back.");
    } else {
      const text = nextNote();
      showNote(text);
      log("A fragment of writing.");
    }
  }
}

function updateFx(dt) {
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 18);
  if (G.noteT > 0) {
    G.noteT -= dt;
    if (G.noteT <= 0) hide(ui.note);
  }
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const q = G.particles[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.92;
    q.vy *= 0.92;
    q.life -= dt;
    if (q.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.y -= 28 * dt;
    f.life -= dt;
    if (f.life <= 0) G.floaters.splice(i, 1);
  }
}

function die() {
  audio.death();
  log("You have died.");
  const rec = {
    time: G.t,
    kills: G.kills,
    floor: G.floor,
    classId: G.classId,
    difficulty: G.difficulty,
    level: G.player.level,
  };
  const prev = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
  if (!prev || rec.time > prev.time) localStorage.setItem(BEST_KEY, JSON.stringify(rec));
  ui.deadStats.textContent = `${CLASSES[G.classId].name} · ${D().name} · ${fmtTime(G.t)} · ${G.kills} slain · floor ${G.floor} · lantern ${G.player.level}`;
  const best = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
  const bestDiff = best && DIFFICULTIES[best.difficulty] ? DIFFICULTIES[best.difficulty].name : "";
  ui.deadBest.textContent = best
    ? `Longest lantern: ${fmtTime(best.time)} (${CLASSES[best.classId].name}${bestDiff ? ", " + bestDiff : ""}, ${best.kills} slain)`
    : "";
  setMode("dead");
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateHud() {
  const p = G.player;
  ui.floor.textContent = W < 600 ? `F${G.floor}` : `Floor ${G.floor} · ${D().name}`;
  ui.timer.textContent = fmtTime(G.t);
  ui.kills.textContent = W < 640 ? `${G.kills}` : `${G.kills} slain`;
  ui.xp.style.width = `${(p.xp / p.xpNeed) * 100}%`;
  const ratio = p.hp / p.maxHp;
  ui.hpfill.style.width = `${Math.max(0, ratio) * 100}%`;
  ui.hpfill.style.background =
    ratio > 0.55
      ? "linear-gradient(90deg, #2a6a28, #6bc45a)"
      : ratio > 0.3
        ? "linear-gradient(90deg, #6a4a10, #d4b04a)"
        : "linear-gradient(90deg, #6a1814, #c44a3a)";
  ui.hptext.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
}

function worldToScreen(x, y) {
  return [x - G.camX, y - G.camY];
}

function drawTiles() {
  const map = G.map;
  const x0 = Math.max(0, Math.floor(G.camX / TILE) - 1);
  const y0 = Math.max(0, Math.floor(G.camY / TILE) - 1);
  const x1 = Math.min(map.width, Math.ceil((G.camX + W) / TILE) + 1);
  const y1 = Math.min(map.height, Math.ceil((G.camY + H) / TILE) + 1);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      const t = map.get(tx, ty);
      const x = tx * TILE - G.camX;
      const y = ty * TILE - G.camY;
      const n = hash(tx, ty);
      if (t === TILE_WALL) {
        ctx.fillStyle = n > 0.7 ? "#161210" : "#100e0c";
        ctx.fillRect(x, y, TILE, TILE);
        if (ty + 1 < map.height && map.get(tx, ty + 1) !== TILE_WALL) {
          ctx.fillStyle = "#2a241c";
          ctx.fillRect(x, y + TILE - 5, TILE, 5);
        }
        if (n > 0.86) {
          ctx.fillStyle = "#1c3a28";
          ctx.fillRect(x + 8, y + 10, 3, 5);
        }
      } else {
        const shade = 0.28 + n * 0.12;
        ctx.fillStyle = `rgb(${72 + shade * 50}, ${58 + shade * 36}, ${40 + shade * 24})`;
        ctx.fillRect(x, y, TILE, TILE);
        if (n > 0.82) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(x + 6, y + 9, 11, 2);
        }
        if (t === TILE_STAIRS) {
          ctx.fillStyle = "#c9a35a";
          ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
          ctx.fillStyle = "#1a140c";
          for (let s = 0; s < 4; s++) ctx.fillRect(x + 8, y + 8 + s * 5, TILE - 16, 3);
        }
      }
    }
  }
}

function drawPickups() {
  for (const u of G.pickups) {
    const [x, y] = worldToScreen(u.x, u.y);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    if (u.kind === "health") ctx.fillStyle = "#8b2c24";
    else if (u.kind === "fuel") ctx.fillStyle = "#c9a35a";
    else ctx.fillStyle = "#d8c8a0";
    ctx.fill();
    ctx.strokeStyle = "#1a140c";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawGems() {
  for (const g of G.gems) {
    const [x, y] = worldToScreen(g.x, g.y);
    ctx.fillStyle = "#7ec8e0";
    ctx.beginPath();
    ctx.moveTo(x, y - g.r);
    ctx.lineTo(x + g.r * 0.7, y);
    ctx.lineTo(x, y + g.r);
    ctx.lineTo(x - g.r * 0.7, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEnemies() {
  for (const e of G.enemies) {
    const [x, y] = worldToScreen(e.x, e.y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + e.r * 0.7, e.r * 0.85, e.r * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = e.hitFlash > 0 ? "#f0e8d8" : e.color;
    ctx.beginPath();
    if (e.kind === "brute") ctx.ellipse(x, y, e.r, e.r * 0.85, 0, 0, TAU);
    else if (e.kind === "runner") ctx.ellipse(x, y, e.r * 1.15, e.r * 0.7, 0, 0, TAU);
    else if (e.kind === "watcher") ctx.ellipse(x, y - 2, e.r * 0.7, e.r * 1.15, 0, 0, TAU);
    else ctx.arc(x, y, e.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = e.eyes;
    const look = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    const ex = Math.cos(look) * 2.5;
    const ey = Math.sin(look) * 2;
    if (e.kind === "watcher") {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * 4 + ex, y - 3 + ey, 1.6, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(x - 3 + ex, y - 2 + ey, 1.7, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 3 + ex, y - 2 + ey, 1.7, 0, TAU);
      ctx.fill();
    }
    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - e.r, y - e.r - 7, e.r * 2, 3);
      ctx.fillStyle = "#c44a3a";
      ctx.fillRect(x - e.r, y - e.r - 7, e.r * 2 * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}

function drawPlayer() {
  const p = G.player;
  const flicker = p.iframes > 0 && Math.sin(G.t * 42) > 0;
  if (flicker) ctx.globalAlpha = 0.4;
  const [x, y] = worldToScreen(p.x, p.y);
  const bob = Math.sin(G.t * (p.moving ? 14 : 6)) * 1.4;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(x, y + p.r + 1, p.r * 0.9, p.r * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1a1410";
  ctx.beginPath();
  ctx.arc(x, y + bob, p.r + 1.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(x, y + bob, p.r, 0, TAU);
  ctx.fill();
  if (p.classId === "rogue") {
    ctx.fillStyle = "#2a2420";
    ctx.beginPath();
    ctx.moveTo(x, y + bob - p.r - 5);
    ctx.lineTo(x - p.r - 1, y + bob - 1);
    ctx.lineTo(x + p.r + 1, y + bob - 1);
    ctx.closePath();
    ctx.fill();
  } else if (p.classId === "warrior") {
    ctx.fillStyle = "#8a8a8a";
    ctx.fillRect(x - p.r + 2, y + bob - 7, p.r * 2 - 4, 5);
    ctx.fillStyle = "#2a2420";
    ctx.fillRect(x - 5, y + bob - 6, 10, 3);
  } else {
    ctx.fillStyle = "#5a3a78";
    ctx.beginPath();
    ctx.moveTo(x, y + bob - p.r - 11);
    ctx.lineTo(x - p.r - 3, y + bob - 1);
    ctx.lineTo(x + p.r + 3, y + bob - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a1a38";
    ctx.fillRect(x - 3, y + bob - p.r - 2, 6, 4);
  }
  const ex = Math.cos(p.facing) * 3;
  const ey = Math.sin(p.facing) * 2;
  ctx.fillStyle = "#f0e6c8";
  ctx.beginPath();
  ctx.arc(x - 3.2 + ex, y + bob - 2 + ey, 2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3.2 + ex, y + bob - 2 + ey, 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1a0a00";
  ctx.beginPath();
  ctx.arc(x - 3.2 + ex + Math.cos(p.facing), y + bob - 2 + ey, 1.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3.2 + ex + Math.cos(p.facing), y + bob - 2 + ey, 1.1, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (p.weapon === "orbit") {
    const count = p.projectiles;
    const radius = 42 * p.area;
    for (let i = 0; i < count; i++) {
      const a = p.orbitAngle + (TAU * i) / count;
      const bx = x + Math.cos(a) * radius;
      const by = y + Math.sin(a) * radius;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + 0.4);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = "#e8e0d0";
      ctx.fillRect(4, -2, 6, 4);
      ctx.restore();
    }
  }
}

function drawBullets() {
  for (const b of G.bullets) {
    const [x, y] = worldToScreen(b.x, b.y);
    if (b.kind === "missile") {
      ctx.fillStyle = "#9b74c4";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e8d6ff";
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    } else {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = "#d8c4a4";
      ctx.fillRect(-8, -1.5, 14, 3);
      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(4, -1.5, 4, 3);
      ctx.restore();
    }
  }
}

function drawFx() {
  for (const q of G.particles) {
    const [x, y] = worldToScreen(q.x, q.y);
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.beginPath();
    ctx.arc(x, y, q.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = "12px Cinzel, Palatino, serif";
  ctx.textAlign = "center";
  for (const f of G.floaters) {
    const [x, y] = worldToScreen(f.x, f.y);
    ctx.globalAlpha = Math.max(0, f.life / 0.7);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function drawLight() {
  const p = G.player;
  const [x, y] = worldToScreen(p.x, p.y);
  const warm = ctx.createRadialGradient(x, y, 0, x, y, 170);
  warm.addColorStop(0, "rgba(255,170,70,0.12)");
  warm.addColorStop(1, "rgba(255,170,70,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(x, y, 36, x, y, p.light);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.62, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0.62)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMinimap() {
  const map = G.map;
  const compact = W < 700 || H < 500;
  const size = compact ? 88 : 148;
  const pad = 10;
  const ox = W - size - pad;
  const oy = compact ? (W < 600 ? 86 : H - size - 16) : H - size - 48;
  ctx.fillStyle = "rgba(10,8,6,0.72)";
  ctx.fillRect(ox - 6, oy - 6, size + 12, size + 12);
  const sx = size / map.width;
  const sy = size / map.height;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const t = map.get(tx, ty);
      if (t === TILE_WALL) continue;
      ctx.fillStyle = t === TILE_STAIRS ? "#c9a35a" : "#3a3228";
      ctx.fillRect(ox + tx * sx, oy + ty * sy, sx + 0.4, sy + 0.4);
    }
  }
  const px = ox + (G.player.x / TILE) * sx;
  const py = oy + (G.player.y / TILE) * sy;
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.arc(px, py, 2.4, 0, TAU);
  ctx.fill();
}

function render() {
  try {
    ctx.fillStyle = "#080706";
    ctx.fillRect(0, 0, W, H);
    if (!G.map || !G.player) return;
    const shx = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    const shy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    ctx.save();
    ctx.translate(shx, shy);
    drawTiles();
    drawPickups();
    drawGems();
    drawEnemies();
    drawPlayer();
    drawBullets();
    drawFx();
    ctx.restore();
    drawLight();
    drawMinimap();
  } catch (err) {
    log(String(err && err.message ? err.message : err));
  }
}

function clampCamera() {
  const maxX = G.map.width * TILE - W;
  const maxY = G.map.height * TILE - H;
  G.camX = Math.max(0, Math.min(maxX, G.camX));
  G.camY = Math.max(0, Math.min(maxY, G.camY));
}

function snapCamera() {
  if (!G.player || !G.map) return;
  G.camX = G.player.x - W / 2;
  G.camY = G.player.y - H / 2;
  clampCamera();
}

function updateCamera() {
  const p = G.player;
  G.camX += (p.x - W / 2 - G.camX) * 0.12;
  G.camY += (p.y - H / 2 - G.camY) * 0.12;
  clampCamera();
}

function update(dt) {
  if (G.mode !== "play") {
    if (G.map) render();
    return;
  }
  G.t += dt;
  updatePlayer(dt);
  fireWeapons(dt);
  updateEnemies(dt);
  updateBullets(dt);
  G.enemies = G.enemies.filter((e) => !e.dead);
  updateGems(dt);
  updatePickups();
  updateFx(dt);
  updateCamera();
  updateHud();
  if (Math.floor(G.t) === 45 && !G.whisper45) {
    G.whisper45 = true;
    log("It follows sound.");
  }
  render();
}

let last = performance.now();
function loop(now) {
  resize();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  requestAnimationFrame(loop);
}

function onKey(e, down) {
  if (down && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  if (down) keys.add(e.code);
  else keys.delete(e.code);
  if (!down) return;
  audio.unlock();

  if (e.code === "KeyM") {
    const muted = audio.toggleMute();
    log(muted ? "The dark goes quiet." : "The dark hums again.");
  }

  if (G.mode === "title" && (e.code === "Enter" || e.code === "Space")) {
    setMode("select");
    return;
  }
  if (G.mode === "select") {
    if (e.code === "Digit1") pickClass("rogue");
    if (e.code === "Digit2") pickClass("warrior");
    if (e.code === "Digit3") pickClass("wizard");
    if (e.code === "Escape") setMode("title");
    return;
  }
  if (G.mode === "difficulty") {
    if (e.code === "Digit1") startRun(G.classId, "candle");
    if (e.code === "Digit2") startRun(G.classId, "lantern");
    if (e.code === "Digit3") startRun(G.classId, "black");
    if (e.code === "Escape") setMode("select");
    return;
  }
  if (G.mode === "levelup") {
    const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
    if (i != null && G.choices[i]) applyUpgrade(G.choices[i].id);
    return;
  }
  if (G.mode === "pause") {
    if (e.code === "Escape" || e.code === "Enter") setMode("play");
    return;
  }
  if (G.mode === "dead") {
    if (e.code === "Enter") startRun(G.classId, G.difficulty);
    if (e.code === "Escape") setMode("title");
    return;
  }
  if (G.mode === "play" && e.code === "Escape") setMode("pause");
}

function onPointerDown(e) {
  audio.unlock();
  if (G.mode !== "play") return;
  if (e.pointerType === "mouse") return;
  if (e.target.closest("button")) return;
  if (stick.active) return;
  stick.active = true;
  stick.id = e.pointerId;
  stick.ox = e.clientX;
  stick.oy = e.clientY;
  stick.dx = 0;
  stick.dy = 0;
  ui.stick.style.left = `${stick.ox}px`;
  ui.stick.style.top = `${stick.oy}px`;
  ui.knob.style.transform = "";
  show(ui.stick);
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch {
    /* some targets cannot capture */
  }
  e.preventDefault();
}

function onPointerMove(e) {
  if (!stick.active || e.pointerId !== stick.id) return;
  const max = 56;
  let dx = e.clientX - stick.ox;
  let dy = e.clientY - stick.oy;
  const m = Math.hypot(dx, dy);
  if (m > max) {
    dx = (dx / m) * max;
    dy = (dy / m) * max;
  }
  stick.dx = Math.abs(dx / max) < 0.12 ? 0 : dx / max;
  stick.dy = Math.abs(dy / max) < 0.12 ? 0 : dy / max;
  ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  e.preventDefault();
}

function onPointerUp(e) {
  if (!stick.active || e.pointerId !== stick.id) return;
  endStick();
}

window.addEventListener("keydown", (e) => onKey(e, true), { passive: false });
window.addEventListener("keyup", (e) => onKey(e, false));
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);
window.addEventListener("pointerdown", onPointerDown, { passive: false });
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("btn-descend").addEventListener("click", () => {
  audio.unlock();
  setMode("select");
});
function pickClass(classId) {
  G.classId = classId;
  setMode("difficulty");
}

document.querySelectorAll(".card").forEach((btn) => {
  btn.addEventListener("click", () => {
    audio.unlock();
    pickClass(btn.dataset.class);
  });
});
document.querySelectorAll(".diff-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    audio.unlock();
    startRun(G.classId, btn.dataset.diff);
  });
});
ui.choices.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  if (G.choices[i]) applyUpgrade(G.choices[i].id);
});
document.getElementById("btn-resume").addEventListener("click", () => setMode("play"));
document.getElementById("btn-title").addEventListener("click", () => setMode("title"));
document.getElementById("btn-retry").addEventListener("click", () => startRun(G.classId, G.difficulty));
document.getElementById("btn-dead-title").addEventListener("click", () => setMode("title"));
ui.pauseBtn.addEventListener("click", () => {
  audio.unlock();
  if (G.mode === "play") setMode("pause");
});
ui.muteBtn.addEventListener("click", () => {
  audio.unlock();
  const muted = audio.toggleMute();
  ui.muteBtn.textContent = muted ? "Unmute" : "Mute";
  log(muted ? "The dark goes quiet." : "The dark hums again.");
});

refreshChrome();
window.matchMedia("(pointer: coarse)").addEventListener("change", refreshChrome);
resize();
const boot = location.hash.slice(1);
if (boot === "select") setMode("select");
if (boot === "difficulty") setMode("difficulty");
if (boot.startsWith("play")) {
  const parts = boot.split("/");
  const id = parts[1] || "rogue";
  const diff = parts[2] || localStorage.getItem(DIFF_KEY) || "lantern";
  G.difficulty = DIFFICULTIES[diff] ? diff : "lantern";
  startRun(CLASSES[id] ? id : "rogue", G.difficulty);
}
requestAnimationFrame(loop);
