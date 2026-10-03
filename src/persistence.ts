import { achievements } from "./content";
import { Simulation } from "./simulation";
export type Profile = {
  schema: number;
  metrics: Record<string, number>;
  unlocked: Record<string, string>;
  missions: string[];
  stars: number;
  fastest: number;
  factions: Record<string, number>;
  commanders: Record<string, number>;
  run: { stage: number; rewards: string[]; seed: string; lives: number } | null;
};
export const freshProfile = (): Profile => ({
  schema: 1,
  metrics: {},
  unlocked: {},
  missions: [],
  stars: 0,
  fastest: 0,
  factions: {},
  commanders: {},
  run: null,
});
let db: IDBDatabase;
export async function initStorage() {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("frontier-command:storage", 2);
    r.onupgradeneeded = () => {
      for (const store of ["saves", "maps", "profile", "settings"])
        if (!r.result.objectStoreNames.contains(store))
          r.result.createObjectStore(store);
    };
    r.onsuccess = () => {
      db = r.result;
      resolve();
    };
    r.onerror = () => reject(r.error);
  });
}
export async function read<T>(
  store: string,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function write(store: string, key: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function list<T>(
  store: string,
): Promise<{ key: string; value: T }[]> {
  return new Promise((resolve, reject) => {
    const out: { key: string; value: T }[] = [];
    const r = db.transaction(store).objectStore(store).openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        out.push({ key: String(c.key), value: c.value });
        c.continue();
      } else resolve(out);
    };
    r.onerror = () => reject(r.error);
  });
}
export async function remove(store: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export function recordMatch(profile: Profile, s: Simulation) {
  const won = s.winner !== null && s.friendly(s.winner, 0);
  const metric = profile.metrics;
  const add = (k: string, n = 1) => (metric[k] = (metric[k] ?? 0) + n);
  add("matches");
  add(won ? "wins" : "losses");
  add("playtime", s.time);
  for (const k of [
    "kills",
    "destroyed",
    "recruited",
    "buildings",
    "gold",
    "wood",
    "captures",
    "research",
  ] as const)
    add(k, s.stats[k]);
  profile.factions[s.settings.faction] =
    (profile.factions[s.settings.faction] ?? 0) + 1;
  profile.commanders[s.settings.commander] =
    (profile.commanders[s.settings.commander] ?? 0) + 1;
  if (won) {
    profile.stars++;
    if (!profile.fastest || s.time < profile.fastest) profile.fastest = s.time;
    if (s.time < 600) add("fast");
    if (s.stats.commanderDeaths === 0) add("unbroken");
    if (s.stats.pauses === 0) add("noPause");
    if (s.settings.size >= 56) add("huge");
    if (["Hard", "Brutal"].includes(s.settings.difficulty)) add("hard");
    if (s.settings.mode === "Survival") add("survival");
    if (s.settings.mode === "Relic Hunt") add("relic");
    if (
      s.map.points
        .filter((p) => p.kind === "gold" || p.kind === "wood")
        .every((p) => p.owner === 0)
    )
      add("allCapture");
    if ((s.stats.created.cavalry ?? 0) > s.stats.recruited / 2) add("cavalry");
    if (
      s.settings.mission &&
      !profile.missions.includes(
        (s.settings.campaignId ?? "rise") + ":" + s.settings.mission.id,
      )
    ) {
      profile.missions.push(
        (s.settings.campaignId ?? "rise") + ":" + s.settings.mission.id,
      );
      add("campaign");
      profile.stars += s.settings.mission.reward;
    }
  }
  const newly: string[] = [];
  for (const a of achievements)
    if (!profile.unlocked[a.id] && (metric[a.metric] ?? 0) >= a.target) {
      profile.unlocked[a.id] = new Date().toISOString();
      newly.push(a.name);
    }
  return newly;
}
