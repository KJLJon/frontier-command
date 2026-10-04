import { commanders } from "./content";
import type { Entity, Event } from "./simulation";
export type ThemeStyle = "toon" | "realistic";
export type Role = "scout" | "ranged" | "heavy" | "commander";
export type Rect = { x: number; y: number; width: number; height: number };
type Frame = {
  column?: number;
  row?: number;
  pixelRect?: Rect;
  pivot?: number[];
  displayName?: string;
};
export type Sound = {
  file: string;
  gain: number;
  loopStartSample?: number;
  loopEndSample?: number;
  sampleRate?: number;
};
export type ThemeManifest = {
  id: string;
  name: string;
  palette: { background: string; accent: string; secondary: string };
  factions: { id: string; color: string; emblem: string }[];
  styles: Record<ThemeStyle, { atlas: string; frames?: Record<Role, Frame> }>;
  sprites: Record<Role, { displayName: string; frame: Frame; pivot: number[] }>;
  environments: Record<ThemeStyle, string>;
  props: {
    atlas: string;
    columns: number;
    rows: number;
    entries: Record<string, Frame>;
  };
  icons: Record<string, string>;
  audio: {
    music: Sound;
    ambientMusic?: Sound;
    combatMusic?: Sound;
    effects: Record<string, Sound>;
  };
};
type Catalog = {
  snapshot: string;
  defaultTheme: string;
  defaultStyle: ThemeStyle;
  themes: {
    id: string;
    name: string;
    manifest: string;
    gameAssets?: string;
    arenaAssets?: string;
  }[];
};

type ExactFrame = Frame & { file: string };
type AssetEntry<T> = {
  displayName?: string;
  styles: Partial<Record<ThemeStyle, T>>;
};
type GameAssets = {
  schemaVersion: number;
  units: Record<string, AssetEntry<ExactFrame>>;
  buildings: Record<string, AssetEntry<ExactFrame>>;
  resourceSites: Record<string, AssetEntry<Record<string, ExactFrame>>>;
};
type Sprite = {
  canvas: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
};
export type LoadedTheme = {
  manifest: ThemeManifest;
  style: ThemeStyle;
  units: Record<Role, Sprite>;
  props: Record<string, Sprite>;
  environment: HTMLImageElement;
  icons: Record<string, string>;
  audio: Record<string, ArrayBuffer>;
  warnings: string[];
  exact: Record<string, Sprite>;
  resources: Record<string, Record<string, Sprite>>;
  names: Record<string, string>;
  pickups: Record<string, HTMLImageElement>;
};
export const themeNames: Record<string, { name: string }> = {
  space: { name: "Orbital Rush · Space" },
  mythic: { name: "Runestone Rally · Mythic" },
  "old-time": { name: "Brass Battalion · Old-time" },
  christmas: { name: "North Pole Dash · Christmas" },
  halloween: { name: "Midnight Mayhem · Halloween" },
  frontier: { name: "Classic Frontier · fallback" },
};
export function unitRole(kind: string): Role {
  if (commanders[kind]) return "commander";
  if (["archer", "support"].includes(kind)) return "ranged";
  if (["worker", "scout"].includes(kind)) return "scout";
  return "heavy";
}
export function propRole(kind: string) {
  return kind === "keep"
    ? "hq"
    : ["tower", "wall"].includes(kind)
      ? "tower"
      : ["stable", "workshop"].includes(kind)
        ? "transport"
        : kind === "depot"
          ? "resource"
          : kind === "house"
            ? "obstacle"
            : "barracks";
}
/** Explicit crop metadata wins; floor both grid edges for non-divisible PNG dimensions. */
export function assetFrame(
  width: number,
  height: number,
  entry: Frame,
  columns: number,
  rows: number,
): Rect {
  const r = entry.pixelRect ?? {
    x: Math.floor(((entry.column ?? 0) * width) / columns),
    y: Math.floor(((entry.row ?? 0) * height) / rows),
    width:
      Math.floor((((entry.column ?? 0) + 1) * width) / columns) -
      Math.floor(((entry.column ?? 0) * width) / columns),
    height:
      Math.floor((((entry.row ?? 0) + 1) * height) / rows) -
      Math.floor(((entry.row ?? 0) * height) / rows),
  };
  if (
    ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
    r.x < 0 ||
    r.y < 0 ||
    r.width <= 0 ||
    r.height <= 0 ||
    r.x + r.width > width ||
    r.y + r.height > height
  )
    throw Error("Invalid sprite rectangle");
  return r;
}
function crop(
  image: HTMLImageElement,
  rect: Rect,
  pivot: number[] = [0.5, 0.88],
): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const c = canvas.getContext("2d")!;
  c.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  // Individual cutouts prevent sampling neighboring cells. Keep the original cell's pivot.
  const pixels = c.getImageData(0, 0, rect.width, rect.height).data;
  let left = rect.width,
    top = rect.height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++)
      if (pixels[(y * rect.width + x) * 4 + 3] > 24) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
  if (left >= right || top >= bottom) throw Error("Empty sprite crop");
  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 3;
  trimmed.height = bottom - top + 3;
  trimmed
    .getContext("2d")!
    .drawImage(
      canvas,
      left,
      top,
      right - left + 1,
      bottom - top + 1,
      1,
      1,
      right - left + 1,
      bottom - top + 1,
    );
  return {
    canvas: trimmed,
    anchorX: rect.width * pivot[0] - left + 1,
    anchorY: rect.height * pivot[1] - top + 1,
    width: rect.width,
    height: rect.height,
  };
}
export class ThemeManager {
  active?: LoadedTheme;
  catalog?: Catalog;
  status = "Loading presentation…";
  loading = false;
  lastError = "";
  private sequence = 0;
  private cacheFailed = false;
  private motions = new Map<number, { kind: string; time: number }>();
  private bytes = new Map<string, Promise<ArrayBuffer>>();
  onChange?: () => void;
  private async fetchBytes(url: string) {
    let cache: Cache | undefined;
    try {
      cache = await caches.open("frontier-theme-assets:v1");
      const cached = await cache.match(url);
      if (cached) return await cached.arrayBuffer();
    } catch {
      this.cacheFailed = true;
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok)
      throw Error("Asset unavailable: " + new URL(url).pathname);
    try {
      await cache?.put(url, response.clone());
    } catch {
      this.cacheFailed = true;
    }
    return await response.arrayBuffer();
  }
  async data(url: string) {
    let existing = this.bytes.get(url);
    if (!existing) {
      existing = this.fetchBytes(url);
      this.bytes.set(url, existing);
      existing.catch(() => this.bytes.delete(url));
    }
    return existing;
  }
  async init() {
    if (this.catalog) return;
    // The catalog is small and versioned by the application service worker.
    const response = await fetch(
      new URL(
        "themes/catalog.json",
        new URL(import.meta.env.BASE_URL, location.origin),
      ),
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw Error("Theme catalog unavailable");
    this.catalog = await response.json();
  }
  private url(file: string, manifest: string) {
    const url = new URL(
      file,
      new URL(
        manifest,
        new URL("themes/", new URL(import.meta.env.BASE_URL, location.origin)),
      ),
    );
    url.searchParams.set("v", this.catalog!.snapshot);
    return url.href;
  }
  private async image(url: string) {
    const data = await this.data(url),
      blobUrl = URL.createObjectURL(new Blob([data]));
    try {
      const image = new Image();
      image.src = blobUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
  async load(id: string, style: ThemeStyle): Promise<boolean> {
    const sequence = ++this.sequence;
    this.loading = true;
    this.status = "Loading theme…";
    this.onChange?.();
    if (id === "frontier") {
      if (this.active)
        Object.values(this.active.icons).forEach(URL.revokeObjectURL);
      this.active = undefined;
      this.status = "Classic Frontier";
      this.loading = false;
      this.onChange?.();
      return true;
    }
    try {
      await this.init();
      const entry = this.catalog!.themes.find((t) => t.id === id);
      if (!entry) throw Error("Unknown theme");
      const manifest = JSON.parse(
        new TextDecoder().decode(
          await this.data(this.url(entry.manifest, "catalog.json")),
        ),
      ) as ThemeManifest;
      if (manifest.id !== id || !manifest.styles[style])
        throw Error("Invalid theme manifest");
      this.status = "Preparing " + manifest.name + "…";
      this.onChange?.();
      const url = (file: string) => this.url(file, entry.manifest);
      const [atlas, props, environment] = await Promise.all([
        this.image(url(manifest.styles[style].atlas)),
        this.image(url(manifest.props.atlas)),
        this.image(url(manifest.environments[style])),
      ]);
      const units = {} as Record<Role, Sprite>;
      for (const role of ["scout", "ranged", "heavy", "commander"] as Role[]) {
        const sprite = manifest.sprites[role],
          frame = manifest.styles[style].frames?.[role] ?? sprite.frame;
        units[role] = crop(
          atlas,
          assetFrame(atlas.naturalWidth, atlas.naturalHeight, frame, 4, 5),
          sprite.pivot,
        );
      }
      const propSprites: Record<string, Sprite> = {};
      for (const [role, frame] of Object.entries(manifest.props.entries))
        propSprites[role] = crop(
          props,
          assetFrame(
            props.naturalWidth,
            props.naturalHeight,
            frame,
            manifest.props.columns,
            manifest.props.rows,
          ),
          frame.pivot,
        );
      const icons: Record<string, string> = {},
        audio: Record<string, ArrayBuffer> = {},
        warnings: string[] = [];
      this.status = "Loading " + manifest.name + " music and effects…";
      this.onChange?.();
      const sounds = {
        ambient: manifest.audio.ambientMusic ?? manifest.audio.music,
        combat: manifest.audio.combatMusic ?? manifest.audio.music,
        ...manifest.audio.effects,
      };
      const exact: Record<string, Sprite> = {},
        resources: Record<string, Record<string, Sprite>> = {},
        names: Record<string, string> = {};
      const pickups: Record<string, HTMLImageElement> = {};
      if (entry.arenaAssets) {
        try {
          const kit = JSON.parse(
            new TextDecoder().decode(
              await this.data(this.url(entry.arenaAssets, "catalog.json")),
            ),
          );
          await Promise.all(
            ["health", "crate", "ammo"].map(async (name) => {
              try {
                if (kit.pickups?.[name]?.file)
                  pickups[name] = await this.image(url(kit.pickups[name].file));
              } catch {
                warnings.push("Arena pickup " + name);
              }
            }),
          );
        } catch {
          warnings.push("Arena art");
        }
      }
      if (entry.gameAssets) {
        try {
          const extra = JSON.parse(
            new TextDecoder().decode(
              await this.data(this.url(entry.gameAssets, "catalog.json")),
            ),
          ) as GameAssets;
          if (extra.schemaVersion !== 1)
            throw Error("Unknown expanded roster schema");
          const loadFrame = async (frame: ExactFrame) => {
            const image = await this.image(url(frame.file));
            return crop(
              image,
              assetFrame(image.naturalWidth, image.naturalHeight, frame, 1, 1),
              frame.pivot,
            );
          };
          // Optional entries fail independently; the established role artwork remains available.
          const tasks: (() => Promise<void>)[] = [];
          for (const [kind, asset] of Object.entries({
            ...extra.units,
            ...extra.buildings,
          })) {
            const frame = asset.styles[style];
            if (!frame?.file) continue;
            tasks.push(async () => {
              try {
                exact[kind] = await loadFrame(frame);
                names[kind] = asset.displayName ?? "";
              } catch {
                warnings.push("Roster " + kind);
              }
            });
          }
          for (const [kind, asset] of Object.entries(
            extra.resourceSites ?? {},
          )) {
            resources[kind] = {};
            for (const [state, frame] of Object.entries(
              asset.styles[style] ?? {},
            ))
              tasks.push(async () => {
                try {
                  resources[kind][state] = await loadFrame(frame);
                } catch {
                  warnings.push("Resource " + kind + "/" + state);
                }
              });
          }
          for (let i = 0; i < tasks.length; i += 4)
            await Promise.all(tasks.slice(i, i + 4).map((task) => task()));
        } catch {
          warnings.push("Expanded roster");
        }
      }
      await Promise.all([
        ...Object.entries(manifest.icons).map(async ([name, file]) => {
          try {
            const data = await this.data(url(file));
            icons[name] = URL.createObjectURL(
              new Blob([data], { type: "image/svg+xml" }),
            );
          } catch {
            warnings.push("Icon " + name);
          }
        }),
        ...Object.entries(sounds).map(async ([name, sound]) => {
          try {
            audio[name] = await this.data(url(sound.file));
          } catch {
            warnings.push("Audio " + name);
          }
        }),
      ]);
      if (sequence !== this.sequence) {
        Object.values(icons).forEach(URL.revokeObjectURL);
        return false;
      }
      if (this.active)
        Object.values(this.active.icons).forEach(URL.revokeObjectURL);
      this.active = {
        manifest,
        style,
        units,
        props: propSprites,
        environment,
        icons,
        audio,
        warnings,
        exact,
        resources,
        names,
        pickups,
      };
      this.bytes.clear(); // Cache API keeps downloads; only the active pack remains in RAM.
      this.status =
        manifest.name + (warnings.length ? " · some assets unavailable" : "");
      this.loading = false;
      this.onChange?.();
      return true;
    } catch (error) {
      this.lastError = String(error);
      if (sequence !== this.sequence) return false;
      this.loading = false;
      this.status = this.active
        ? "Theme unavailable; kept " + this.active.manifest.name
        : "Theme unavailable; using Classic Frontier";
      this.bytes.clear();
      this.onChange?.();
      return false;
    }
  }
  async downloadAll(progress: (message: string) => void) {
    await this.init();
    this.cacheFailed = false;
    const urls = new Set<string>();
    for (const entry of this.catalog!.themes) {
      const manifest = JSON.parse(
        new TextDecoder().decode(
          await this.data(this.url(entry.manifest, "catalog.json")),
        ),
      ) as ThemeManifest;
      for (const style of ["toon", "realistic"] as ThemeStyle[]) {
        urls.add(this.url(manifest.styles[style].atlas, entry.manifest));
        urls.add(this.url(manifest.environments[style], entry.manifest));
      }
      if (entry.gameAssets) {
        const extra = JSON.parse(
          new TextDecoder().decode(
            await this.data(this.url(entry.gameAssets, "catalog.json")),
          ),
        ) as GameAssets;
        const scan = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          if ("file" in value && typeof value.file === "string")
            urls.add(this.url(value.file, entry.manifest));
          for (const [key, child] of Object.entries(value))
            if (key !== "sticker") scan(child);
        };
        scan(extra);
      }
      if (entry.arenaAssets) {
        const kit = JSON.parse(
          new TextDecoder().decode(
            await this.data(this.url(entry.arenaAssets, "catalog.json")),
          ),
        );
        for (const name of ["health", "crate", "ammo"])
          if (kit.pickups?.[name]?.file)
            urls.add(this.url(kit.pickups[name].file, entry.manifest));
      }
      for (const file of [
        manifest.props.atlas,
        ...Object.values(manifest.icons),
        ...Object.values(manifest.audio.effects).map((s) => s.file),
        manifest.audio.ambientMusic?.file ?? manifest.audio.music.file,
        manifest.audio.combatMusic?.file ?? manifest.audio.music.file,
      ])
        urls.add(this.url(file, entry.manifest));
    }
    let count = 0;
    const files = [...urls];
    for (let i = 0; i < files.length; i += 3) {
      await Promise.all(
        files.slice(i, i + 3).map(async (url) => {
          await this.data(url);
          count++;
          progress(`Downloading worlds: ${count} / ${files.length}`);
        }),
      );
      this.bytes.clear();
    }
    if (this.cacheFailed)
      throw Error(
        "Browser storage could not retain all theme files. Online play remains available.",
      );
    progress("All five worlds and both art styles are ready offline.");
  }
  faction(team: number) {
    const list = this.active?.manifest.factions;
    if (team === 4) return { color: "#f4c95e", emblem: "pentagon" };
    if (team === 5) return { color: "#ff9aca", emblem: "hexagon" };
    return team < 0
      ? { color: "#dec58e", emblem: "circle" }
      : (list?.[team % list.length] ?? {
          color: team === 0 ? "#65d7f4" : "#ffad7d",
          emblem: team === 0 ? "diamond" : "triangle",
        });
  }
  name(kind: string, building = false) {
    if (!this.active) return "";
    if (this.active.names[kind]) return this.active.names[kind];
    return building
      ? (this.active.manifest.props.entries[propRole(kind)]?.displayName ?? "")
      : this.active.manifest.sprites[unitRole(kind)].displayName;
  }
  event(event: Event, time: number) {
    if (event.type === "hit") {
      if (event.target !== undefined)
        this.motions.set(event.target, { kind: "hit", time });
      if (event.source !== undefined)
        this.motions.set(event.source, { kind: "attack", time });
    }
    if (event.type === "spawn" && (event.source ?? event.target) !== undefined)
      this.motions.set((event.source ?? event.target)!, {
        kind: "spawn",
        time,
      });
    if (this.motions.size > 500)
      for (const [id, motion] of this.motions)
        if (time - motion.time > 1) this.motions.delete(id);
  }
  draw(
    c: CanvasRenderingContext2D,
    sprite: Sprite,
    x: number,
    y: number,
    size: number,
    motion = { x: 0, y: 0, rotation: 0, alpha: 1 },
  ) {
    const scale = size / Math.max(sprite.canvas.width, sprite.canvas.height);
    c.save();
    c.translate(x + motion.x, y + motion.y);
    c.rotate(motion.rotation);
    c.globalAlpha *= motion.alpha;
    c.drawImage(
      sprite.canvas,
      -sprite.anchorX * scale,
      -sprite.anchorY * scale,
      sprite.canvas.width * scale,
      sprite.canvas.height * scale,
    );
    c.restore();
  }
  entity(
    c: CanvasRenderingContext2D,
    e: Entity,
    x: number,
    y: number,
    z: number,
    time: number,
    selected: boolean,
    reduced: boolean,
  ) {
    if (!this.active) return false;
    const role = e.building ? propRole(e.kind) : unitRole(e.kind),
      sprite =
        this.active.exact[e.kind] ??
        (e.building
          ? this.active.props[role]
          : this.active.units[role as Role]);
    if (!sprite) return false;
    const faction = this.faction(e.team),
      size =
        (e.building
          ? e.kind === "keep"
            ? 108
            : 78
          : commanders[e.kind]
            ? 57
            : e.kind === "siege"
              ? 49
              : 41) * z;
    c.save();
    c.strokeStyle = faction.color;
    c.fillStyle = faction.color;
    c.lineWidth = (selected ? 3 : 1.5) * z;
    c.beginPath();
    c.ellipse(
      x,
      y,
      (e.building ? 29 : 14) * z,
      (e.building ? 13 : 6) * z,
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
    this.badge(c, x, y + 9 * z, faction.emblem, 3 * z);
    const moving = e.route.length > 0 || !!e.steer?.remaining;
    const bob =
      reduced || e.building
        ? 0
        : moving
          ? -Math.abs(Math.sin((time + e.id * 0.1) * 11)) * 2 * z
          : Math.sin((time + e.id) * 3) * 0.4 * z;
    const recoil =
      reduced || e.building
        ? 0
        : e.cooldown > 0
          ? Math.sin((Math.min(e.cooldown, 0.4) / 0.4) * Math.PI) * 2 * z
          : 0;
    this.draw(c, sprite, x, y, size, {
      x:
        recoil +
        (!reduced && this.motions.get(e.id)?.kind === "hit"
          ? Math.sin((time - this.motions.get(e.id)!.time) * 65) *
            3 *
            z *
            Math.max(0, 1 - (time - this.motions.get(e.id)!.time) / 0.4)
          : 0),
      y: bob,
      rotation: reduced ? 0 : moving ? Math.sin(time * 11) * 0.018 : 0,
      alpha:
        e.build > 0
          ? 0.6
          : this.motions.get(e.id)?.kind === "spawn"
            ? Math.min(
                1,
                Math.max(0.25, (time - this.motions.get(e.id)!.time) / 0.4),
              )
            : 1,
    });
    const motion = this.motions.get(e.id);
    if (motion && time - motion.time > 0.7) this.motions.delete(e.id);
    if (motion?.kind === "hit" && time - motion.time < 0.3) {
      c.strokeStyle = "#fff4cc";
      c.lineWidth = 2 * z;
      c.beginPath();
      c.ellipse(x, y, 15 * z, 7 * z, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (selected || e.hp < e.maxHp || commanders[e.kind]) {
      c.fillStyle = "#092029";
      c.fillRect(x - 17 * z, y - size * 0.84, 34 * z, 4 * z);
      c.fillStyle = faction.color;
      c.fillRect(
        x - 17 * z,
        y - size * 0.84,
        34 * z * Math.max(0, e.hp / e.maxHp),
        4 * z,
      );
      c.font = `${9 * z}px system-ui`;
      c.textAlign = "center";
      c.fillStyle = "#ffffff";
      c.fillText(
        e.building ? e.kind : e.kind === "warlord" ? "Warlord" : e.kind,
        x,
        y + 21 * z,
      );
    }
    if (e.build > 0) {
      c.font = `${10 * z}px system-ui`;
      c.textAlign = "center";
      c.fillStyle = "#fff0b8";
      c.fillText("Building…", x, y + 23 * z);
    }
    c.restore();
    return true;
  }
  badge(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    shape: string,
    size: number,
  ) {
    c.save();
    c.translate(x, y);
    if (shape === "diamond") {
      c.rotate(Math.PI / 4);
      c.fillRect(-size, -size, size * 2, size * 2);
    } else if (shape === "triangle") {
      c.beginPath();
      c.moveTo(0, -size * 1.5);
      c.lineTo(size * 1.4, size);
      c.lineTo(-size * 1.4, size);
      c.closePath();
      c.fill();
    } else if (shape === "circle") {
      c.beginPath();
      c.arc(0, 0, size * 1.2, 0, Math.PI * 2);
      c.fill();
    } else if (shape === "pentagon" || shape === "hexagon") {
      const count = shape === "pentagon" ? 5 : 6;
      c.beginPath();
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count - Math.PI / 2;
        const x = Math.cos(angle) * size * 1.3,
          y = Math.sin(angle) * size * 1.3;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fill();
    } else c.fillRect(-size, -size, size * 2, size * 2);
    c.restore();
  }
}
