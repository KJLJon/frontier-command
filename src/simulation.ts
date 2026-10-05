import {
  units,
  buildings,
  factions,
  commanders,
  technologies,
  biomes,
  scales,
  type Mission,
  type Action,
} from "./content";
import {
  generateMap,
  dist,
  path,
  index,
  passable,
  validateMap,
  rng,
  hash,
  type MapData,
  type MapSettings,
  type Point,
} from "./map";
export type Settings = MapSettings & {
  faction: string;
  commander: string;
  difficulty: string;
  personality: string;
  mode: string;
  scale: keyof typeof scales;
  starting: number;
  population: number;
  speed: number;
  teams: number[];
  aiOnly?: boolean;
  preparation?: number;
  campaignId?: string;
  mission?: Mission;
  bonus?: string;
};
export type Order = {
  type:
    | "Move"
    | "Attack"
    | "AttackMove"
    | "Hold"
    | "Build"
    | "Recruit"
    | "Research"
    | "Capture"
    | "UseAbility"
    | "Rally";
  team: number;
  ids?: number[];
  x?: number;
  y?: number;
  target?: number;
  kind?: string;
  slot?: number;
  dx?: number;
  dy?: number;
};
export type Entity = Point & {
  id: number;
  team: number;
  kind: string;
  building: boolean;
  hp: number;
  maxHp: number;
  cooldown: number;
  build: number;
  queue: { kind: string; remaining: number }[];
  route: Point[];
  order: string;
  target?: number;
  buff: number;
  destination?: Point;
  pursuing?: boolean;
  slow: number;
  abilities: number[];
  rally?: Point;
  respawn?: number;
  steer?: { dx: number; dy: number; remaining: number };
};
export type Player = {
  team: number;
  faction: string;
  commander: string;
  gold: number;
  wood: number;
  tech: string[];
  score: number;
  alive: boolean;
  ai: boolean;
  nextAI: number;
  personality: string;
  plan: string;
  memory: { id: number; kind: string; x: number; y: number }[];
};
export type Event = {
  sound?: string;
  type: string;
  x?: number;
  y?: number;
  text?: string;
  team?: number;
  target?: number;
  damage?: number;
  sourceKind?: string;
  targetKind?: string;
  source?: number;
};
export type Stats = {
  kills: number;
  destroyed: number;
  recruited: number;
  buildings: number;
  gold: number;
  wood: number;
  captures: number;
  research: number;
  commanderDeaths: number;
  pauses: number;
  created: Record<string, number>;
};
export class Simulation {
  version = 2;
  tick = 0;
  time = 0;
  map: MapData;
  settings: Settings;
  players: Player[] = [];
  entities: Entity[] = [];
  commands: Order[] = [];
  events: Event[] = [];
  nextId = 1;
  winner: number | null = null;
  paused = false;
  pauseUses = 0;
  triggers: number[] = [];
  visible: number[][] = [];
  explored: number[][] = [];
  stats: Stats = {
    kills: 0,
    destroyed: 0,
    recruited: 0,
    buildings: 0,
    gold: 0,
    wood: 0,
    captures: 0,
    research: 0,
    commanderDeaths: 0,
    pauses: 0,
    created: {},
  };
  wave = 0;
  objective = "";
  random: () => number;
  constructor(settings: Settings, map?: MapData) {
    if (map) {
      const errors = validateMap(map);
      if (errors.length)
        throw Error("Invalid map: " + errors.slice(0, 3).join("; "));
    }
    this.settings = structuredClone(settings);
    this.map = map ? structuredClone(map) : generateMap(settings);
    for (const point of this.map.points) {
      if (point.kind !== "gold" && point.kind !== "wood") continue;
      point.capacity ??=
        (point.kind === "gold" ? 1200 : 1600) * settings.resources;
      point.remaining ??= point.capacity;
    }
    this.random = rng(hash(settings.seed));
    this.objective =
      settings.mission?.objective ??
      (settings.mode === "Conquest"
        ? "Destroy the rival command keeps."
        : settings.mode === "Survival"
          ? "Protect your keep through 12 escalating waves."
          : "Control ancient relics. Reach 1,000 influence.");
    for (let t = 0; t < this.map.spawns.length; t++) {
      this.players.push({
        team: settings.teams[t] ?? t,
        faction:
          t === 0
            ? settings.faction
            : (settings.mission?.modifiers?.enemyFaction ??
              Object.keys(factions)[t % 3]),
        commander:
          t === 0 ? settings.commander : Object.keys(commanders)[t % 3],
        gold: settings.starting,
        wood: settings.starting,
        tech: [],
        score: 0,
        alive: true,
        ai: t !== 0 || !!settings.aiOnly,
        nextAI: 3,
        personality: settings.personality,
        plan: "Establish economy",
        memory: [],
      });
      this.visible.push(Array(this.map.tiles.length).fill(0));
      this.explored.push(Array(this.map.tiles.length).fill(0));
      const p = this.map.spawns[t];
      this.spawn("keep", t, p.x + 0.5, p.y + 0.5, true);
      this.spawn(this.players[t].commander, t, p.x + 1.5, p.y + 1.5);
      this.spawn("swordsman", t, p.x - 1, p.y);
      this.spawn("spearman", t, p.x, p.y - 1);
      for (const point of this.map.points)
        if (
          point.kind !== "camp" &&
          point.kind !== "relic" &&
          dist(point, p) < 6
        )
          point.owner = t;
    }
    for (const p of this.map.points.filter((p) => p.kind === "camp"))
      for (let j = 0; j < 2; j++)
        this.spawn("swordsman", -1, p.x + j * 0.7, p.y);
    for (const p of this.map.placements ?? [])
      this.spawn(p.kind, p.team, p.x + 0.5, p.y + 0.5, p.building);
    this.updateVision();
  }
  spawn(
    kind: string,
    team: number,
    x: number,
    y: number,
    building = false,
    construction = false,
  ) {
    const d = building ? buildings[kind] : (units[kind] ?? commanders[kind]);
    if (!d) throw Error(`Unknown entity ${kind}`);
    const faction = factions[this.players[team]?.faction ?? "ironhold"];
    const hp = d.hp * faction.hp;
    const e: Entity = {
      id: this.nextId++,
      kind,
      team,
      x,
      y,
      building,
      hp: construction ? hp * 0.1 : hp,
      maxHp: hp,
      cooldown: 0,
      build: construction ? (d as typeof buildings.keep).time : 0,
      queue: [],
      route: [],
      order: "Guard",
      buff: 0,
      slow: 0,
      abilities: [0, 0, 0],
    };
    this.entities.push(e);
    return e;
  }
  population(t: number) {
    return (
      this.entities
        .filter((e) => e.team === t && !e.building && e.hp > 0)
        .reduce((n, e) => n + (units[e.kind]?.pop ?? 0), 0) +
      this.entities
        .filter((e) => e.team === t)
        .reduce(
          (n, e) => n + e.queue.reduce((q, v) => q + units[v.kind].pop, 0),
          0,
        )
    );
  }
  capacity(t: number) {
    return Math.min(
      this.settings.population,
      this.entities
        .filter((e) => e.team === t && e.building && e.build === 0 && e.hp > 0)
        .reduce((n, e) => n + (buildings[e.kind].pop ?? 0), 0),
    );
  }
  has(t: number, k: string) {
    return this.entities.some(
      (e) => e.team === t && e.kind === k && e.hp > 0 && e.build === 0,
    );
  }
  friendly(a: number, b: number) {
    return a >= 0 && b >= 0 && this.players[a].team === this.players[b].team;
  }
  issue(o: Order) {
    this.commands.push(structuredClone(o));
  }
  pay(t: number, g: number, w: number) {
    const p = this.players[t];
    if (!p || p.gold < g || p.wood < w) return false;
    p.gold -= g;
    p.wood -= w;
    return true;
  }
  reject(text: string, t: number) {
    if (t === 0) this.events.push({ type: "notice", text });
    return false;
  }
  blocked() {
    return new Set(
      this.entities
        .filter((e) => e.building && e.hp > 0)
        .map((e) => index(this.map, e.x, e.y)),
    );
  }
  get preparationRemaining() {
    return Math.max(
      0,
      (this.settings.mission || this.settings.aiOnly
        ? 0
        : (this.settings.preparation ?? 0)) - this.time,
    );
  }
  buildProblem(team: number, kind: string, point: Point) {
    const d = buildings[kind];
    if (!d) return "Unknown building.";
    if (d.requires && !this.has(team, d.requires))
      return `Requires ${buildings[d.requires].name}.`;
    if (!passable(this.map, point.x, point.y))
      return "Choose clear ground; water and rocks block building.";
    if (
      this.entities.some((e) => e.building && e.hp > 0 && dist(e, point) < 1.7)
    )
      return "Leave more space beside existing buildings.";
    if (
      !this.entities.some(
        (e) => e.team === team && e.hp > 0 && dist(e, point) < 9,
      )
    )
      return "Build near your base or your squad.";
    const p = this.players[team];
    if (!p || p.gold < d.gold || p.wood < d.wood)
      return "Not enough resources.";
    return undefined;
  }
  execute(o: Order) {
    const p = this.players[o.team];
    if (!p || !p.alive) return;
    const chosen = this.entities.filter(
      (e) => o.ids?.includes(e.id) && e.team === o.team && e.hp > 0,
    );
    const x = o.x ?? 0,
      y = o.y ?? 0;
    if (o.type === "Build") {
      const d = buildings[o.kind ?? ""];
      if (!d) return;
      const problem = this.buildProblem(o.team, o.kind!, { x, y });
      if (problem) return this.reject(problem, o.team);
      if (!this.pay(o.team, d.gold, d.wood))
        return this.reject("Not enough resources.", o.team);
      this.spawn(
        o.kind!,
        o.team,
        Math.floor(x) + 0.5,
        Math.floor(y) + 0.5,
        true,
        true,
      );
      this.events.push({ type: "build", x, y, team: o.team });
      return;
    }
    if (o.type === "Recruit") {
      const d = units[o.kind ?? ""];
      if (!d) return;
      const b =
        chosen.find((e) => e.kind === d.building && e.build === 0) ??
        this.entities.find(
          (e) =>
            e.team === o.team &&
            e.kind === d.building &&
            e.build === 0 &&
            e.hp > 0,
        );
      if (!b)
        return this.reject(
          `Build a ${buildings[d.building].name} first.`,
          o.team,
        );
      if (b.queue.length >= 5)
        return this.reject("Recruitment queue is full.", o.team);
      if (this.population(o.team) + d.pop > this.capacity(o.team))
        return this.reject("Population limit. Build a house.", o.team);
      const cost = factions[p.faction].cost;
      if (!this.pay(o.team, Math.ceil(d.gold * cost), Math.ceil(d.wood * cost)))
        return this.reject("Not enough resources.", o.team);
      b.queue.push({ kind: o.kind!, remaining: d.time });
      return;
    }
    if (o.type === "Research") {
      const d = technologies[o.kind ?? ""];
      if (!d || p.tech.includes(o.kind!)) return;
      if (!this.has(o.team, d.requires))
        return this.reject(`Requires ${buildings[d.requires].name}.`, o.team);
      if (!this.pay(o.team, d.gold, d.wood))
        return this.reject("Not enough resources.", o.team);
      p.tech.push(o.kind!);
      if (o.team === 0) this.stats.research++;
      this.events.push({
        type: "research",
        text: d.name + " completed.",
        team: o.team,
      });
      return;
    }
    if (o.type === "UseAbility") {
      const e = this.entities.find(
        (e) =>
          e.team === o.team && !e.building && commanders[e.kind] && e.hp > 0,
      );
      if (!e) return;
      const slot = o.slot ?? 0;
      if (!Number.isInteger(slot) || slot < 0 || slot > 2) return;
      if (e.abilities[slot] > 0)
        return this.reject("Ability is recharging.", o.team);
      e.abilities[slot] =
        [12, 22, 35][slot] * (p.tech.includes("commander") ? 0.7 : 1);
      this.events.push({
        type: "ability",
        x: e.x,
        y: e.y,
        text: commanders[e.kind].abilities[slot],
        team: o.team,
      });
      const allies = this.entities.filter(
        (v) => this.friendly(v.team, e.team) && dist(v, e) < 7 && v.hp > 0,
      );
      const enemies = this.entities.filter(
        (v) => !this.friendly(v.team, e.team) && dist(v, e) < 7 && v.hp > 0,
      );
      if (e.kind === "warlord") {
        if (slot === 0) {
          const target = enemies.sort((a, b) => dist(a, e) - dist(b, e))[0];
          if (target) {
            const dest = { x: target.x - 1, y: target.y };
            if (passable(this.map, dest.x, dest.y)) {
              e.x = dest.x;
              e.y = dest.y;
            }
            for (const v of enemies.filter((v) => dist(v, e) < 3))
              this.hit(e, v, 60);
          }
        }
        if (slot === 1) allies.forEach((v) => (v.buff = 10));
        if (slot === 2) {
          e.hp = Math.min(e.maxHp, e.hp + 200);
          e.buff = 12;
        }
      }
      if (e.kind === "ranger") {
        if (slot === 0) {
          const dest = { x: e.x + 3, y: e.y };
          if (passable(this.map, dest.x, dest.y)) {
            e.x = dest.x;
            e.y = dest.y;
          }
        }
        if (slot === 1) enemies.forEach((v) => (v.slow = 10));
        if (slot === 2) enemies.forEach((v) => this.hit(e, v, 45));
      }
      if (e.kind === "engineer") {
        if (slot === 0) {
          const dest = { x: e.x + 1, y: e.y + 1 };
          if (
            passable(this.map, dest.x, dest.y) &&
            !this.entities.some((v) => v.building && dist(v, dest) < 1.5)
          ) {
            const turret = this.spawn("tower", e.team, dest.x, dest.y, true);
            turret.maxHp = 280;
            turret.hp = 280;
          }
        }
        if (slot === 1)
          allies.forEach((v) => (v.hp = Math.min(v.maxHp, v.hp + 180)));
        if (slot === 2)
          enemies.forEach((v) => this.hit(e, v, v.building ? 180 : 45));
      }
      return;
    }
    const blocked = this.blocked();
    chosen.forEach((e, i) => {
      if (o.type === "Rally") {
        e.rally = { x, y };
        return;
      }
      if (e.building) return;
      if (o.dx !== undefined && o.dy !== undefined) {
        e.steer = { dx: o.dx, dy: o.dy, remaining: 0.22 };
        e.route = [];
        e.order = "Guard";
        e.destination = undefined;
        e.pursuing = false;
        e.target = undefined;
        return;
      }
      e.steer = undefined;
      e.order = o.type;
      e.target = o.target;
      e.destination = undefined;
      e.pursuing = false;
      e.route = [];
      if (["Move", "AttackMove", "Capture"].includes(o.type)) {
        const dest = {
          x: Math.max(
            0.5,
            Math.min(this.map.settings.size - 0.5, x + (i % 4) * 0.45),
          ),
          y: Math.max(
            0.5,
            Math.min(
              this.map.settings.size - 0.5,
              y + Math.floor(i / 4) * 0.45,
            ),
          ),
        };
        e.route = path(this.map, e, dest, blocked);
        e.destination = dest;
      }
    });
  }
  setPause() {
    if (this.settings.difficulty === "Brutal")
      return this.reject("Tactical pause is disabled on Brutal.", 0);
    if (
      !this.paused &&
      this.settings.difficulty === "Hard" &&
      this.pauseUses >= 3
    )
      return this.reject("All three tactical pauses used.", 0);
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseUses++;
      this.stats.pauses++;
    }
    return true;
  }
  hit(a: Entity, b: Entity, base?: number) {
    if (a.hp <= 0 || b.hp <= 0) return;
    const amount = base ?? combatDamage(a, b, this.players);
    b.hp -= amount;
    this.events.push({
      type: "hit",
      sound:
        (a.building
          ? (buildings[a.kind].range ?? 0)
          : (units[a.kind]?.range ?? commanders[a.kind]?.range ?? 0)) > 2
          ? "arrow"
          : "hit",
      x: a.x,
      y: a.y,
      target: b.id,
      damage: amount,
      sourceKind: a.kind,
      source: a.id,
      targetKind: b.kind,
      team: a.team,
    });
    if (b.hp <= 0) {
      this.events.push({
        type: "death",
        x: b.x,
        y: b.y,
        team: b.team,
        targetKind: b.kind,
        target: b.id,
      });
      if (a.team === 0) {
        if (b.building) this.stats.destroyed++;
        else this.stats.kills++;
      }
      if (commanders[b.kind]) {
        b.respawn = 30;
        if (b.team === 0) this.stats.commanderDeaths++;
      }
    }
  }
  step(dt = 0.1) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.paused || this.winner !== null) return;
    this.events = [];
    this.commands.splice(0).forEach((o) => this.execute(o));
    this.time += dt;
    this.tick++;
    const blocked = this.blocked();
    if (this.tick % 10 === 1) this.updateVision();
    if (this.tick % 10 === 1) this.ai();
    for (const e of this.entities) {
      if (e.hp <= 0) {
        if (e.respawn !== undefined && this.players[e.team]?.alive) {
          e.respawn -= dt;
          if (e.respawn <= 0) {
            const p = this.map.spawns[e.team];
            e.x = p.x + 1;
            e.y = p.y + 1;
            e.hp = e.maxHp;
            e.respawn = undefined;
            e.route = [];
            e.order = "Hold";
            e.target = undefined;
            e.destination = undefined;
            e.pursuing = false;
            e.steer = undefined;
            e.buff = 0;
            e.slow = 0;
          }
        }
        continue;
      }
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.buff = Math.max(0, e.buff - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.abilities = e.abilities.map((v) => Math.max(0, v - dt));
      if (e.build > 0) {
        e.build = Math.max(0, e.build - dt);
        e.hp = Math.min(
          e.maxHp,
          e.hp + (e.maxHp * dt) / buildings[e.kind].time,
        );
        if (e.build === 0) {
          e.hp = e.maxHp;
          if (e.team === 0) this.stats.buildings++;
        }
        continue;
      }
      if (e.queue.length) {
        e.queue[0].remaining -= dt;
        if (e.queue[0].remaining <= 0) {
          const k = e.queue.shift()!.kind;
          const point = this.freeNear(e);
          const v = this.spawn(k, e.team, point.x, point.y);
          this.events.push({
            type: "spawn",
            x: v.x,
            y: v.y,
            team: v.team,
            target: v.id,
            targetKind: v.kind,
          });
          if (e.rally) {
            v.route = path(this.map, v, e.rally, blocked);
            v.order = "AttackMove";
            v.destination = { ...e.rally };
          }
          if (e.team === 0) {
            this.stats.recruited++;
            this.stats.created[k] = (this.stats.created[k] ?? 0) + 1;
          }
        }
      }
      const d = e.building
        ? buildings[e.kind]
        : (units[e.kind] ?? commanders[e.kind]);
      if (!e.building && e.steer && e.steer.remaining > 0) {
        const control = e.steer;
        control.remaining -= dt;
        const length = Math.hypot(control.dx, control.dy) || 1;
        const speed =
          ("speed" in d ? d.speed : 0) *
          factions[this.players[e.team]?.faction ?? "ironhold"].speed *
          (e.slow > 0 ? 0.45 : 1) *
          dt;
        const dx = (control.dx / length) * speed,
          dy = (control.dy / length) * speed;
        const valid = (x: number, y: number) =>
          passable(this.map, x, y) &&
          !this.entities.some(
            (v) => v.building && v.hp > 0 && dist(v, { x, y }) < 0.85,
          );
        if (valid(e.x + dx, e.y + dy)) {
          e.x += dx;
          e.y += dy;
        } else if (valid(e.x + dx, e.y)) e.x += dx;
        else if (valid(e.x, e.y + dy)) e.y += dy;
      }
      let range = ("range" in d ? d.range : 0) ?? 0;
      if (
        !e.building &&
        range > 2 &&
        this.players[e.team]?.tech.includes("range")
      )
        range += 1.5;
      if (e.kind === "support" && e.cooldown === 0) {
        const ally = this.entities
          .filter(
            (v) =>
              v.id !== e.id &&
              this.friendly(v.team, e.team) &&
              v.hp > 0 &&
              v.hp < v.maxHp &&
              dist(v, e) < 5,
          )
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ally) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 24);
          e.cooldown = 1.4;
          this.events.push({ type: "heal", x: ally.x, y: ally.y });
          continue;
        }
      }
      let target = e.target
        ? this.entities.find((v) => v.id === e.target && v.hp > 0)
        : undefined;
      if (target && this.friendly(e.team, target.team)) target = undefined;
      if (
        target &&
        e.team >= 0 &&
        !this.visible[e.team][index(this.map, target.x, target.y)]
      )
        target = undefined;
      if (!target && e.order !== "Move" && range > 0) {
        let nearest = Infinity;
        for (const v of this.entities) {
          if (
            v.hp <= 0 ||
            v.id === e.id ||
            this.friendly(v.team, e.team) ||
            (e.team === -1 && v.team === -1)
          )
            continue;
          const dd = dist(v, e);
          if (
            dd <
              (e.team === 0 && !this.players[0].ai && e.order === "Guard"
                ? range
                : Math.max(range, 5)) &&
            dd < nearest &&
            (e.team < 0 || this.visible[e.team][index(this.map, v.x, v.y)])
          ) {
            nearest = dd;
            target = v;
          }
        }
      }
      if (!target && e.pursuing && e.destination) {
        e.route = path(this.map, e, e.destination, blocked);
        e.pursuing = false;
      }
      if (target && dist(e, target) <= range) {
        if (e.cooldown === 0) {
          this.hit(e, target);
          e.cooldown = e.building ? 1.7 : "rate" in d ? d.rate : 1;
          if (
            this.players[e.team]?.faction === "arcanists" &&
            e.kind === "support"
          )
            target.slow = 2;
        }
        continue;
      }
      if (
        target &&
        !e.building &&
        !(e.steer && e.steer.remaining > 0) &&
        e.order !== "Hold" &&
        !(e.team === 0 && !this.players[0].ai && e.order === "Guard") &&
        e.team !== -1 &&
        this.tick % 15 === e.id % 15
      ) {
        const dest = target.building
          ? this.freeNear(target)
          : { x: target.x, y: target.y };
        e.route = path(this.map, e, dest, blocked);
        e.pursuing = true;
      }
      if (!e.building && e.route.length) {
        const next = e.route[0];
        if (
          blocked.has(index(this.map, next.x, next.y)) &&
          dist(next, e) > 0.8
        ) {
          e.route = e.destination
            ? path(this.map, e, e.destination, blocked)
            : [];
          continue;
        }
        const delta = dist(e, next);
        const tile = this.map.tiles[index(this.map, e.x, e.y)];
        const speed =
          ("speed" in d ? d.speed : 0) *
          factions[this.players[e.team]?.faction ?? "ironhold"].speed *
          (this.players[e.team]?.tech.includes("logistics") ? 1.15 : 1) *
          (e.slow > 0 ? 0.45 : 1) *
          (tile === 1 || tile === 2
            ? biomes[this.map.settings.biome].slow * 0.8
            : 1);
        const step = speed * dt;
        if (delta <= step) {
          e.x = next.x;
          e.y = next.y;
          e.route.shift();
        } else {
          e.x += ((next.x - e.x) / delta) * step;
          e.y += ((next.y - e.y) / delta) * step;
        }
      }
    }
    const scale = scales[this.settings.scale];
    for (let t = 0; t < this.players.length; t++) {
      const p = this.players[t];
      if (!p.alive) continue;
      let g = 1.4,
        w = 1.2;
      const factor =
        scale.income *
        factions[p.faction].income *
        biomes[this.map.settings.biome].resource *
        (p.tech.includes("economy") ? 1.3 : 1);
      for (const point of this.map.points) {
        if (point.owner !== t) continue;
        const depot = this.entities.some(
          (e) =>
            e.team === t &&
            e.kind === "depot" &&
            e.build === 0 &&
            e.hp > 0 &&
            dist(e, point) < 7,
        )
          ? 1.4
          : 1;
        if (point.kind === "gold" || point.kind === "wood") {
          const yieldAmount = Math.min(
            point.remaining ?? 0,
            2.1 * depot * dt * factor,
          );
          point.remaining = Math.max(0, (point.remaining ?? 0) - yieldAmount);
          if (point.kind === "gold") g += yieldAmount / (dt * factor);
          else w += yieldAmount / (dt * factor);
          if (yieldAmount > 0 && point.remaining === 0) {
            this.events.push({
              type: "depleted",
              x: point.x,
              y: point.y,
              team: t,
              text: `${point.kind === "gold" ? "Gold mine" : "Timber grove"} depleted. Scout for another deposit.`,
            });
          }
        }
        if (
          point.kind === "relic" &&
          ["Domination", "Relic Hunt"].includes(this.settings.mode)
        )
          p.score +=
            dt *
            (this.settings.mode === "Relic Hunt" ? 1.25 : 1) *
            (this.time > scale.minutes * 30 ? 2 : 1);
      }
      p.gold += g * dt * factor;
      p.wood += w * dt * factor;
      if (t === 0) {
        this.stats.gold += g * dt * factor;
        this.stats.wood += w * dt * factor;
      }
    }
    for (const point of this.map.points) {
      if (point.kind === "camp" || point.remaining === 0) continue;
      const nearby = this.entities.filter(
        (e) => !e.building && e.hp > 0 && e.team >= 0 && dist(e, point) < 2.6,
      );
      const teams = [...new Set(nearby.map((e) => e.team))];
      if (teams.length === 1 && teams[0] !== point.owner) {
        if (point.claimant !== teams[0]) point.progress = 0;
        point.claimant = teams[0];
        point.progress += dt * (nearby.length * 0.3 + 0.7);
        if (point.progress >= 6) {
          point.owner = teams[0];
          point.progress = 0;
          point.claimant = undefined;
          this.events.push({
            type: "capture",
            x: point.x,
            y: point.y,
            team: point.owner,
          });
          if (point.owner === 0) this.stats.captures++;
        }
      } else point.progress = Math.max(0, point.progress - dt * 0.5);
    }
    if (this.settings.mode === "Survival") {
      const waveLength = (scale.minutes * 60) / 13;
      if (this.wave < 12 && this.time > (this.wave + 1) * waveLength) {
        this.wave++;
        const base = this.map.spawns[0],
          spawn = this.map.spawns[1];
        for (let i = 0; i < 4 + this.wave * 2; i++) {
          const k =
            this.wave > 6 && i % 5 === 0
              ? "siege"
              : i % 3 === 0
                ? "cavalry"
                : i % 2
                  ? "swordsman"
                  : "archer";
          const e = this.spawn(
            k,
            1,
            spawn.x + (i % 3),
            spawn.y + Math.floor(i / 3) * 0.3,
          );
          this.issue({
            type: "AttackMove",
            team: 1,
            ids: [e.id],
            x: base.x,
            y: base.y,
          });
        }
        this.events.push({
          type: "notice",
          text: `Wave ${this.wave} of 12 approaches!`,
        });
      }
      if (this.wave === 12 && this.time > 13 * waveLength) this.finish(0);
    }
    for (const camp of this.map.points.filter(
      (p) => p.kind === "camp" && p.owner === -1,
    )) {
      if (
        !this.entities.some(
          (e) => e.team === -1 && e.hp > 0 && dist(e, camp) < 4,
        )
      ) {
        const claimant = this.entities.find(
          (e) => e.team >= 0 && e.hp > 0 && !e.building && dist(e, camp) < 5,
        );
        if (claimant) {
          camp.owner = claimant.team;
          this.players[claimant.team].gold += 120;
          this.players[claimant.team].wood += 80;
          this.events.push({
            type: "capture",
            x: camp.x,
            y: camp.y,
            team: claimant.team,
            text: "Neutral camp cleared: +120 gold, +80 wood.",
          });
        }
      }
    }
    this.runTriggers();
    this.checkVictory();
    if (this.entities.length > 600)
      this.entities = this.entities.filter(
        (e) => e.hp > 0 || e.respawn !== undefined,
      );
  }
  freeNear(p: Point) {
    for (let r = 1; r < 5; r++)
      for (const [dx, dy] of [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ]) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (
          passable(this.map, q.x, q.y) &&
          !this.entities.some((e) => e.building && e.hp > 0 && dist(e, q) < 1.2)
        )
          return q;
      }
    return { x: p.x + 1, y: p.y + 1 };
  }
  updateVision() {
    const n = this.map.settings.size;
    for (let t = 0; t < this.players.length; t++) {
      this.visible[t].fill(0);
      for (const e of this.entities) {
        if (!this.friendly(e.team, t) || e.hp <= 0) continue;
        const r =
          (e.building
            ? 8
            : (units[e.kind]?.vision ?? commanders[e.kind]?.vision ?? 5)) *
          biomes[this.map.settings.biome].vision;
        for (
          let y = Math.max(0, Math.floor(e.y - r));
          y < Math.min(n, e.y + r);
          y++
        )
          for (
            let x = Math.max(0, Math.floor(e.x - r));
            x < Math.min(n, e.x + r);
            x++
          )
            if (Math.hypot(x - e.x, y - e.y) < r) {
              this.visible[t][y * n + x] = 1;
              this.explored[t][y * n + x] = 1;
            }
      }
    }
  }
  ai() {
    for (let t = 0; t < this.players.length; t++) {
      const p = this.players[t];
      if (!p.ai || !p.alive || this.time < p.nextAI) continue;
      const difficulty = this.settings.difficulty;
      p.nextAI =
        this.time +
        (difficulty === "Easy"
          ? 8
          : difficulty === "Normal"
            ? 4
            : difficulty === "Hard"
              ? 2.5
              : 1.5);
      const army = this.entities.filter(
          (e) => e.team === t && !e.building && e.hp > 0,
        ),
        base = this.entities.find(
          (e) => e.team === t && e.kind === "keep" && e.hp > 0,
        );
      if (!base) continue;
      for (const e of this.entities)
        if (
          e.team >= 0 &&
          !this.friendly(e.team, t) &&
          e.hp > 0 &&
          this.visible[t][index(this.map, e.x, e.y)]
        ) {
          const old = p.memory.find((v) => v.id === e.id);
          if (old) {
            old.x = e.x;
            old.y = e.y;
          } else p.memory.push({ id: e.id, kind: e.kind, x: e.x, y: e.y });
        }
      let build: string | undefined;
      if (this.population(t) > this.capacity(t) - 4) build = "house";
      else if (!this.has(t, "barracks")) build = "barracks";
      else if (!this.has(t, "range")) build = "range";
      else if (
        !this.has(t, "depot") &&
        ["Economic", "Expansionist"].includes(p.personality)
      )
        build = "depot";
      else if (!this.has(t, "blacksmith") && this.time > 80)
        build = "blacksmith";
      else if (!this.has(t, "stable") && this.time > 100) build = "stable";
      else if (!this.has(t, "workshop") && this.time > 160) build = "workshop";
      else if (!this.has(t, "arcane") && this.time > 220) build = "arcane";
      else if (
        p.personality === "Defensive" &&
        this.entities.filter((e) => e.team === t && e.kind === "tower").length <
          3
      )
        build = "tower";
      if (build) {
        for (let j = 0; j < 20; j++) {
          const angle = (this.nextId + j) * 2.399;
          const q = {
            x: base.x + Math.cos(angle) * (3 + j * 0.2),
            y: base.y + Math.sin(angle) * (3 + j * 0.2),
          };
          if (
            passable(this.map, q.x, q.y) &&
            !this.entities.some((e) => e.building && e.hp > 0 && dist(e, q) < 2)
          ) {
            this.execute({
              type: "Build",
              team: t,
              kind: build,
              x: q.x,
              y: q.y,
            });
            break;
          }
        }
      }
      const visibleEnemy = this.entities.filter(
        (e) =>
          e.team >= 0 &&
          !this.friendly(e.team, t) &&
          e.hp > 0 &&
          this.visible[t][index(this.map, e.x, e.y)],
      );
      const cavalry = visibleEnemy.filter((e) => e.kind === "cavalry").length;
      let kind = Object.keys(units)[Math.floor(this.time / 12 + t) % 6];
      if (p.personality === "Adaptive" && cavalry > 2) kind = "spearman";
      if (!this.has(t, units[kind].building))
        kind =
          this.has(t, "range") && army.length % 3 === 0
            ? "archer"
            : "swordsman";
      this.execute({ type: "Recruit", team: t, kind });
      if (p.gold > 350 && this.has(t, "blacksmith"))
        this.execute({
          type: "Research",
          team: t,
          kind: p.tech.includes("weapons") ? "armor" : "weapons",
        });
      const knownKeep =
        visibleEnemy.find((e) => e.kind === "keep") ??
        p.memory.find((e) => e.kind === "keep");
      const destinations = this.map.points
        .filter(
          (q) =>
            q.kind !== "camp" &&
            q.remaining !== 0 &&
            q.owner !== t &&
            (this.preparationRemaining === 0 ||
              !this.map.spawns.some(
                (spawn, team) => !this.friendly(team, t) && dist(q, spawn) < 10,
              )),
        )
        .sort((a, b) => dist(a, base) - dist(b, base));
      const capture = destinations[0];
      const attackSize =
        p.personality === "Aggressive"
          ? 5
          : p.personality === "Defensive"
            ? 12
            : p.personality === "Economic"
              ? 14
              : 8;
      let goal: Point | undefined;
      if (army.length >= attackSize && this.preparationRemaining === 0) {
        goal =
          knownKeep ?? this.map.spawns.find((_, i) => !this.friendly(i, t));
        p.plan = "Attack enemy headquarters";
        if (
          ["Domination", "Relic Hunt"].includes(this.settings.mode) ||
          p.personality === "Raider"
        )
          goal =
            destinations.find((v) => v.kind === "relic") ?? capture ?? goal;
      } else {
        goal = capture;
        p.plan =
          this.preparationRemaining > 0
            ? "Prepare defenses; no opening raid"
            : "Capture territory and recruit";
      }
      const threatened = this.entities.find(
        (e) =>
          e.hp > 0 &&
          !this.friendly(e.team, t) &&
          e.team !== -1 &&
          dist(e, base) < 8 &&
          this.visible[t][index(this.map, e.x, e.y)],
      );
      if (threatened) {
        goal = threatened;
        p.plan = "Defend headquarters";
      }
      if (goal)
        this.execute({
          type: "AttackMove",
          team: t,
          ids: army.map((e) => e.id),
          x: goal.x,
          y: goal.y,
        });
      if (army.some((e) => commanders[e.kind] && e.cooldown > 0))
        this.execute({
          type: "UseAbility",
          team: t,
          slot: Math.floor(this.time / 10) % 3,
        });
    }
  }
  runTriggers() {
    const mission = this.settings.mission;
    if (!mission) return;
    for (let i = 0; i < mission.triggers.length; i++) {
      if (this.triggers.includes(i)) continue;
      const t = mission.triggers[i],
        team = t.team ?? 0;
      let fire = false;
      if (t.when === "time") fire = this.time >= t.value;
      if (t.when === "capture")
        fire =
          team === 0
            ? this.stats.captures >= t.value
            : this.map.points.filter(
                (p) => p.owner === team && p.kind === "relic",
              ).length >= t.value;
      if (t.when === "kills") fire = this.stats.kills >= t.value;
      if (t.when === "resources") fire = this.players[team].gold >= t.value;
      if (t.when === "region" && t.region)
        fire = this.entities.some(
          (e) =>
            e.team === team && e.hp > 0 && dist(e, t.region!) < t.region!.r,
        );
      if (t.when === "destroyed")
        fire = this.entities.some((e) => e.id === t.value && e.hp <= 0);
      if (fire) {
        this.triggers.push(i);
        t.actions.forEach((a) => this.action(a));
      }
    }
  }
  action(a: Action) {
    const t = a.team ?? 0;
    if (a.type === "dialogue" || a.type === "objective") {
      this.events.push({ type: "dialogue", text: a.text });
      if (a.type === "objective") this.objective = a.text ?? this.objective;
    }
    if (a.type === "resources") {
      this.players[t].gold += a.gold ?? 0;
      this.players[t].wood += a.wood ?? 0;
    }
    if (a.type === "spawn") {
      const p = this.map.spawns[t];
      for (let i = 0; i < (a.count ?? 1); i++)
        this.spawn(
          a.unit!,
          t,
          a.x ?? p.x + (i % 3),
          a.y ?? p.y + Math.floor(i / 3),
        );
    }
    if (a.type === "reveal") this.explored[t].fill(1);
    if (a.type === "alliance")
      this.players[t].team = this.players[a.other ?? 0].team;
    if (a.type === "victory") this.finish(t);
    if (a.type === "defeat") this.finish(t === 0 ? 1 : 0);
  }
  checkVictory() {
    for (let t = 0; t < this.players.length; t++) {
      if (
        this.players[t].alive &&
        !this.entities.some(
          (e) => e.team === t && e.kind === "keep" && e.hp > 0,
        )
      ) {
        this.players[t].alive = false;
        this.entities.filter((e) => e.team === t).forEach((e) => (e.hp = 0));
      }
    }
    const alive = this.players
      .map((p, i) => ({ p, i }))
      .filter((v) => v.p.alive);
    const teams = new Set(alive.map((v) => v.p.team));
    if (teams.size === 1 && alive.length && this.settings.mode !== "Survival")
      this.finish(alive[0].i);
    if (!this.players[0].alive && !this.settings.aiOnly)
      this.finish(alive[0]?.i ?? 1);
    if (["Domination", "Relic Hunt"].includes(this.settings.mode)) {
      const p = this.players.findIndex((p) => p.score >= 1000);
      if (p >= 0) this.finish(p);
    }
    const max = scales[this.settings.scale].minutes * 60 * 1.5;
    if (this.time > max && this.winner === null) {
      const scores = this.players.map((p, i) =>
        p.alive
          ? p.score +
            this.entities
              .filter((e) => e.team === i && e.hp > 0)
              .reduce((n, e) => n + e.hp * (e.building ? 0.2 : 1), 0) +
            this.map.points.filter((q) => q.owner === i).length * 200
          : -1,
      );
      this.finish(scores.indexOf(Math.max(...scores)));
    }
  }
  finish(t: number) {
    if (this.winner === null) {
      this.winner = t;
      this.events.push({ type: "end", team: t });
    }
  }
  serialize() {
    return JSON.stringify({
      schema: 2,
      map: this.map,
      settings: this.settings,
      tick: this.tick,
      time: this.time,
      players: this.players,
      entities: this.entities,
      nextId: this.nextId,
      winner: this.winner,
      commands: this.commands,
      stats: this.stats,
      explored: this.explored,
      triggers: this.triggers,
      wave: this.wave,
      objective: this.objective,
      pauseUses: this.pauseUses,
      paused: this.paused,
    });
  }
  static restore(text: string) {
    const d = migrateSave(JSON.parse(text));
    const s = new Simulation(d.settings, d.map);
    for (const key of [
      "tick",
      "time",
      "players",
      "entities",
      "nextId",
      "winner",
      "commands",
      "stats",
      "explored",
      "triggers",
      "wave",
      "objective",
      "pauseUses",
      "paused",
    ] as const)
      if (d[key] !== undefined) (s as any)[key] = d[key];
    s.updateVision();
    return s;
  }
}
export function combatDamage(a: Entity, b: Entity, players: Player[]) {
  const d = a.building
    ? buildings[a.kind]
    : (units[a.kind] ?? commanders[a.kind]);
  let damage = ("damage" in d ? d.damage : 0) ?? 0;
  const tag = units[a.kind]?.tag,
    target = units[b.kind]?.tag;
  if (tag === "spear" && target === "cavalry") damage *= 1.8;
  if (tag === "cavalry" && target === "ranged") damage *= 1.6;
  if (tag === "ranged" && target === "infantry") damage *= 1.3;
  if (tag === "siege" && b.building) damage *= 2.6;
  if (players[a.team]?.tech.includes("weapons")) damage *= 1.25;
  if (players[b.team]?.tech.includes("armor")) damage *= 0.8;
  if (a.buff > 0) damage *= 1.35;
  return damage;
}
export function migrateSave(d: any) {
  if (!d || typeof d !== "object") throw Error("Invalid save");
  if (d.schema === 1) {
    d.schema = 2;
    d.pauseUses = 0;
  }
  if (d.stats) d.stats.destroyed ??= 0;
  if (Array.isArray(d.players))
    for (const p of d.players)
      if (
        Array.isArray(p.memory) &&
        p.memory.some((v: any) => typeof v === "number")
      )
        p.memory = p.memory
          .map((id: number) => d.entities?.find((e: any) => e.id === id))
          .filter(Boolean)
          .map((e: any) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y }));
  if (d.schema !== 2)
    throw Error(
      "This save uses a newer or unsupported format. Your saved data has been preserved.",
    );
  if (
    !d.map ||
    !d.settings ||
    !Array.isArray(d.entities) ||
    !Array.isArray(d.players) ||
    !Number.isFinite(d.time)
  )
    throw Error("This save is damaged. Other saves are unaffected.");
  for (const e of d.entities) {
    if (
      !e ||
      !(e.building
        ? buildings[e.kind]
        : (units[e.kind] ?? commanders[e.kind])) ||
      !Number.isFinite(e.x) ||
      !Number.isFinite(e.y) ||
      !Number.isFinite(e.hp) ||
      !Array.isArray(e.route) ||
      !Array.isArray(e.queue) ||
      !Array.isArray(e.abilities) ||
      e.team < -1 ||
      e.team >= d.players.length
    )
      throw Error(
        "This save contains invalid entity data. Its original data has been preserved.",
      );
  }
  return d;
}
