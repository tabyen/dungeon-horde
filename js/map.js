export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_DOOR = 2;
export const TILE_STAIRS = 3;
export const TILE = 32;

const MIN_ROOM = 6;
const MAX_ROOM = 12;

export function makeRng(seed) {
  let s = (seed >>> 0) || ((Math.random() * 0xffffffff) >>> 0) || 1;
  const api = {
    get seed() {
      return s;
    },
    next() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    },
    int(a, b) {
      if (b < a) return a;
      return a + Math.floor(api.next() * (b - a + 1));
    },
    pick(arr) {
      return arr[api.int(0, arr.length - 1)];
    },
  };
  return api;
}

export function generateDungeon({ width = 56, height = 40, seed } = {}) {
  let last = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const nextSeed = seed == null ? undefined : (seed + attempt) >>> 0;
    last = tryGenerate({ width, height, seed: nextSeed });
    if (last.rooms.length >= 5) return last;
  }
  return last;
}

function tryGenerate({ width, height, seed }) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(width * height);
  tiles.fill(TILE_WALL);

  const idx = (x, y) => y * width + x;
  const set = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < width && y < height) tiles[idx(x, y)] = t;
  };
  const get = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return TILE_WALL;
    return tiles[idx(x, y)];
  };

  class Node {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.left = null;
      this.right = null;
      this.room = null;
    }
  }

  const root = new Node(1, 1, width - 2, height - 2);

  function split(node, depth) {
    if (depth <= 0) return;
    const canH = node.h >= MIN_ROOM * 2 + 2;
    const canV = node.w >= MIN_ROOM * 2 + 2;
    if (!canH && !canV) return;

    let horiz;
    if (node.w > node.h * 1.25 && canV) horiz = false;
    else if (node.h > node.w * 1.25 && canH) horiz = true;
    else if (canH && canV) horiz = rng.next() < 0.5;
    else horiz = canH;

    if (horiz) {
      const splitY = rng.int(node.y + MIN_ROOM, node.y + node.h - MIN_ROOM);
      node.left = new Node(node.x, node.y, node.w, splitY - node.y);
      node.right = new Node(node.x, splitY, node.w, node.y + node.h - splitY);
    } else {
      const splitX = rng.int(node.x + MIN_ROOM, node.x + node.w - MIN_ROOM);
      node.left = new Node(node.x, node.y, splitX - node.x, node.h);
      node.right = new Node(splitX, node.y, node.x + node.w - splitX, node.h);
    }
    split(node.left, depth - 1);
    split(node.right, depth - 1);
  }

  split(root, 5);
  const rooms = [];

  function carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) set(x, y, TILE_FLOOR);
    }
  }

  function createRooms(node) {
    if (!node.left && !node.right) {
      const maxW = Math.min(MAX_ROOM, node.w - 2);
      const maxH = Math.min(MAX_ROOM, node.h - 2);
      if (maxW < 4 || maxH < 4) return;
      const minW = Math.min(MIN_ROOM, maxW);
      const minH = Math.min(MIN_ROOM, maxH);
      const w = rng.int(minW, maxW);
      const h = rng.int(minH, maxH);
      const rx = rng.int(node.x + 1, Math.max(node.x + 1, node.x + node.w - w - 1));
      const ry = rng.int(node.y + 1, Math.max(node.y + 1, node.y + node.h - h - 1));
      node.room = { x: rx, y: ry, w, h };
      rooms.push(node.room);
      carveRoom(node.room);
      return;
    }
    if (node.left) createRooms(node.left);
    if (node.right) createRooms(node.right);
    node.room = (node.left && node.left.room) || (node.right && node.right.room);
  }

  function center(room) {
    return {
      x: (room.x + room.w / 2) | 0,
      y: (room.y + room.h / 2) | 0,
    };
  }

  function carveCorridor(a, b) {
    let x = a.x;
    let y = a.y;
    while (x !== b.x) {
      set(x, y, TILE_FLOOR);
      set(x, y - 1, TILE_FLOOR);
      x += b.x > x ? 1 : -1;
    }
    while (y !== b.y) {
      set(x, y, TILE_FLOOR);
      set(x - 1, y, TILE_FLOOR);
      y += b.y > y ? 1 : -1;
    }
    set(x, y, TILE_FLOOR);
  }

  function connect(node) {
    if (!node.left || !node.right) return;
    connect(node.left);
    connect(node.right);
    if (node.left.room && node.right.room) {
      carveCorridor(center(node.left.room), center(node.right.room));
    }
  }

  createRooms(root);
  connect(root);

  const fallback = { x: (width / 2) | 0, y: (height / 2) | 0, w: 4, h: 4 };
  const mapCx = width / 2;
  const mapCy = height / 2;
  let spawnRoom = rooms[0] || fallback;
  let spawnDist = Infinity;
  for (const room of rooms) {
    const c = center(room);
    const d = (c.x - mapCx) ** 2 + (c.y - mapCy) ** 2;
    if (d < spawnDist) {
      spawnDist = d;
      spawnRoom = room;
    }
  }
  const spawn = center(spawnRoom);
  let stairRoom = rooms[rooms.length - 1] || spawnRoom;
  let stairDist = -1;
  for (const room of rooms) {
    const c = center(room);
    const d = (c.x - spawn.x) ** 2 + (c.y - spawn.y) ** 2;
    if (d > stairDist) {
      stairDist = d;
      stairRoom = room;
    }
  }
  const stairs = center(stairRoom);
  set(stairs.x, stairs.y, TILE_STAIRS);

  const floors = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = get(x, y);
      if (t === TILE_FLOOR || t === TILE_DOOR || t === TILE_STAIRS) floors.push({ x, y });
    }
  }

  function isWalkable(tx, ty) {
    const t = get(tx, ty);
    return t === TILE_FLOOR || t === TILE_DOOR || t === TILE_STAIRS;
  }

  function circleHitsWall(px, py, r) {
    const x0 = Math.floor((px - r) / TILE);
    const y0 = Math.floor((py - r) / TILE);
    const x1 = Math.floor((px + r) / TILE);
    const y1 = Math.floor((py + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isWalkable(tx, ty)) continue;
        const nearestX = Math.max(tx * TILE, Math.min(px, tx * TILE + TILE));
        const nearestY = Math.max(ty * TILE, Math.min(py, ty * TILE + TILE));
        const dx = px - nearestX;
        const dy = py - nearestY;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  return {
    width,
    height,
    tiles,
    rooms,
    spawn,
    stairs,
    floors,
    seed: rng.seed,
    get,
    isWalkable,
    circleHitsWall,
    worldX: (tx) => (tx + 0.5) * TILE,
    worldY: (ty) => (ty + 0.5) * TILE,
  };
}
