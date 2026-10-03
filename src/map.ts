import { biomes } from "./content";
export type Point = { x: number; y: number };
export type MapSettings = {
  seed: string;
  size: number;
  players: number;
  biome: string;
  preset: string;
  resources: number;
  roughness: number;
  water: number;
  camps: number;
  objectives: number;
  weirdness: number;
};
export type MapData = {
  version: number;
  settings: MapSettings;
  tiles: number[];
  spawns: Point[];
  points: (Point & {
    kind: "gold" | "wood" | "relic" | "camp";
    owner: number;
    progress: number;
    remaining?: number;
    capacity?: number;
    claimant?: number;
  })[];
  placements?: {
    x: number;
    y: number;
    kind: string;
    team: number;
    building: boolean;
  }[];
  victory?: string;
};
export function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const defaults: MapSettings = {
  seed: "JON-492817",
  size: 36,
  players: 2,
  biome: "grassland",
  preset: "Balanced",
  resources: 1,
  roughness: 0.35,
  water: 0.12,
  camps: 3,
  objectives: 3,
  weirdness: 0.2,
};
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function index(m: MapData, x: number, y: number) {
  return Math.floor(y) * m.settings.size + Math.floor(x);
}
export function passable(m: MapData, x: number, y: number) {
  const n = m.settings.size;
  return (
    x >= 0 &&
    y >= 0 &&
    x < n &&
    y < n &&
    m.tiles[index(m, x, y)] !== 3 &&
    m.tiles[index(m, x, y)] !== 4
  );
}
export function validateMap(m: MapData): string[] {
  const errors: string[] = [];
  const n = m.settings.size;
  if (!Number.isInteger(n) || n < 20 || n > 72 || m.tiles.length !== n * n)
    return ["Invalid dimensions or tile data"];
  if (!biomes[m.settings.biome]) errors.push("Unknown biome");
  if (m.spawns.length < 2)
    errors.push("At least two spawn locations are required");
  if (m.tiles.some((t) => !Number.isInteger(t) || t < 0 || t > 4))
    errors.push("Invalid terrain");
  for (let k = 0; k < m.spawns.length; k++) {
    const s = m.spawns[k];
    if (!passable(m, s.x, s.y)) {
      errors.push(`Spawn ${k + 1} is blocked`);
      continue;
    }
    const seen = new Set<number>();
    const queue = [index(m, s.x, s.y)];
    seen.add(queue[0]);
    for (let i = 0; i < queue.length; i++) {
      const v = queue[i],
        x = v % n,
        y = Math.floor(v / n);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (passable(m, x + dx, y + dy)) {
          const q = (y + dy) * n + x + dx;
          if (!seen.has(q)) {
            seen.add(q);
            queue.push(q);
          }
        }
    }
    if (seen.size < 40) errors.push(`Spawn ${k + 1} cannot expand`);
    for (const p of [...m.spawns, ...m.points.filter((p) => p.kind !== "camp")])
      if (!seen.has(index(m, p.x, p.y)))
        errors.push(`Spawn ${k + 1}: unreachable location at ${p.x},${p.y}`);
    for (const kind of ["gold", "wood"])
      if (
        !m.points.some(
          (p) =>
            p.kind === kind &&
            seen.has(index(m, p.x, p.y)) &&
            dist(p, s) < n * 0.4,
        )
      )
        errors.push(`Spawn ${k + 1} needs nearby ${kind}`);
  }
  for (const p of m.placements ?? [])
    if (!passable(m, p.x, p.y))
      errors.push(`Invalid placement at ${p.x},${p.y}`);
  return [...new Set(errors)];
}
export function generateMap(settings: MapSettings): MapData {
  const s = { ...settings };
  if (
    !Number.isInteger(s.size) ||
    s.size < 20 ||
    s.size > 72 ||
    s.players < 2 ||
    s.players > 6 ||
    !biomes[s.biome]
  )
    throw Error("Unsupported map settings");
  const random = rng(hash(JSON.stringify(s) + ":map-v1"));
  const n = s.size,
    competitive = s.preset === "Competitive";
  const tiles = Array.from({ length: n * n }, () => {
    const v = random();
    return v < s.water * 0.45
      ? 3
      : v < s.water * 0.45 + s.roughness * 0.15
        ? 4
        : v < 0.25 + s.roughness * 0.2 + s.weirdness * 0.1
          ? 1
          : v < 0.4
            ? 2
            : 0;
  });
  const m: MapData = { version: 1, settings: s, tiles, spawns: [], points: [] };
  const clear = (x: number, y: number, r = 2) => {
    for (let yy = Math.floor(y - r); yy <= y + r; yy++)
      for (let xx = Math.floor(x - r); xx <= x + r; xx++)
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) m.tiles[yy * n + xx] = 0;
  };
  const road = (a: Point, b: Point) => {
    let x = Math.floor(a.x),
      y = Math.floor(a.y);
    while (x !== Math.floor(b.x) || y !== Math.floor(b.y)) {
      clear(x, y, 1);
      if (x !== Math.floor(b.x)) x += Math.sign(b.x - x);
      if (y !== Math.floor(b.y)) y += Math.sign(b.y - y);
    }
    clear(x, y);
  };
  for (let i = 0; i < s.players; i++) {
    const angle = Math.PI * 0.75 + (i * Math.PI * 2) / s.players;
    const jitter = competitive ? 0 : (random() - 0.5) * s.weirdness * 3;
    const p = {
      x: Math.round((n - 1) / 2 + Math.cos(angle) * (n * 0.34 + jitter)),
      y: Math.round((n - 1) / 2 + Math.sin(angle) * (n * 0.34 + jitter)),
    };
    m.spawns.push(p);
    clear(p.x, p.y, 4);
    road(p, { x: n / 2, y: n / 2 });
    for (let k = 0; k < 2; k++) {
      const direction = i % 2 === 0 ? 1 : -1;
      const q = {
        x: Math.max(2, Math.min(n - 3, p.x + (k ? 3 : -3) * direction)),
        y: Math.max(2, Math.min(n - 3, p.y - 3 * direction)),
      };
      clear(q.x, q.y);
      m.points.push({
        ...q,
        kind: k ? "wood" : "gold",
        owner: -1,
        progress: 0,
      });
    }
  }
  for (let i = 0; i < Math.round(6 * s.resources); i++) {
    const p = competitive
      ? {
          x: Math.round(
            (n - 1) / 2 +
              Math.cos((i * Math.PI * 2) / Math.round(6 * s.resources)) *
                n *
                0.24,
          ),
          y: Math.round(
            (n - 1) / 2 +
              Math.sin((i * Math.PI * 2) / Math.round(6 * s.resources)) *
                n *
                0.24,
          ),
        }
      : {
          x: 3 + Math.floor(random() * (n - 6)),
          y: 3 + Math.floor(random() * (n - 6)),
        };
    if (m.points.some((q) => dist(q, p) < 3)) continue;
    road(p, { x: n / 2, y: n / 2 });
    m.points.push({
      ...p,
      kind: i % 2 ? "wood" : "gold",
      owner: -1,
      progress: 0,
    });
  }
  for (let i = 0; i < s.objectives; i++) {
    const angle = (i * Math.PI * 2) / Math.max(1, s.objectives);
    const p = {
      x: Math.round(n / 2 + Math.cos(angle) * n * 0.13),
      y: Math.round(n / 2 + Math.sin(angle) * n * 0.13),
    };
    road(p, { x: n / 2, y: n / 2 });
    m.points.push({ ...p, kind: "relic", owner: -1, progress: 0 });
  }
  for (let i = 0; i < s.camps; i++) {
    let p = {
      x: 4 + Math.floor(random() * (n - 8)),
      y: 4 + Math.floor(random() * (n - 8)),
    };
    if (
      m.spawns.some((q) => dist(q, p) < 7) ||
      m.points.some((q) => dist(q, p) < 3)
    )
      continue;
    road(p, { x: n / 2, y: n / 2 });
    m.points.push({ ...p, kind: "camp", owner: -1, progress: 0 });
  }
  if (competitive && s.players === 2) {
    m.spawns[1] = { x: n - 1 - m.spawns[0].x, y: n - 1 - m.spawns[0].y };
    for (let i = 0; i < m.tiles.length; i++) {
      const j = m.tiles.length - 1 - i;
      if (i < j) {
        const terrain = m.tiles[i] === 0 || m.tiles[j] === 0 ? 0 : m.tiles[i];
        m.tiles[i] = m.tiles[j] = terrain;
      }
    }
    m.points = m.points.filter((p) => p.x + p.y <= n - 1);
    const mirrors = m.points.map((p) => ({
      ...p,
      x: n - 1 - p.x,
      y: n - 1 - p.y,
    }));
    m.points.push(
      ...mirrors.filter((p) => !m.points.some((q) => dist(q, p) < 1)),
    );
  }
  const errors = validateMap(m);
  if (errors.length) throw Error(errors.join("; "));
  return m;
}
// Breadth-first grid search, used only on new orders or blocked paths, never each frame.
export function path(
  m: MapData,
  a: Point,
  b: Point,
  blocked: Set<number> = new Set(),
): Point[] {
  const n = m.settings.size,
    start = index(m, a.x, a.y);
  let goal = index(m, b.x, b.y);
  if (!passable(m, b.x, b.y)) return [];
  const prev = new Int32Array(n * n).fill(-1);
  const queue = [start];
  prev[start] = start;
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    if (q === goal) break;
    const x = q % n,
      y = Math.floor(q / n);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!passable(m, x + dx, y + dy)) continue;
      const j = (y + dy) * n + x + dx;
      if (prev[j] === -1 && (!blocked.has(j) || j === goal)) {
        prev[j] = q;
        queue.push(j);
      }
    }
  }
  if (prev[goal] === -1) return [];
  const out: Point[] = [];
  while (goal !== start) {
    out.push({ x: (goal % n) + 0.5, y: Math.floor(goal / n) + 0.5 });
    goal = prev[goal];
  }
  return out.reverse();
}
