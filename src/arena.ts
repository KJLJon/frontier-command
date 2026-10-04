import {
  Simulation,
  type Entity,
  type Order,
  type Settings,
} from "./simulation";
import { commanders } from "./content";
import { defaults, dist, type Point, type MapData } from "./map";

export type Supply = Point & { id: number; kind: "heal" | "escort" | "charge" };
export type Hazard = Point & { at: number; radius: number };
export const arenaUpgrades = {
  escort: {
    name: "Reinforcement drop",
    description: "Two archers and two swordsmen join your escort.",
  },
  armor: {
    name: "Fortify squad",
    description:
      "Increase current and future squad health by 20%, and heal survivors.",
  },
  charge: {
    name: "Overcharge",
    description:
      "Refresh all commander abilities and empower your squad for 45 seconds.",
  },
};
export type ArenaUpgrade = keyof typeof arenaUpgrades;

// An isolated ruleset: combat and controls are shared, economy and campaign progress are not.
export class RushArena extends Simulation {
  readonly center: Point = { x: 12, y: 12 };
  readonly duration = 240;
  supplies: Supply[] = [];
  hazards: Hazard[] = [];
  collected = [0, 0, 0, 0];
  upgrades = 0;
  armorLevel = 0;
  pendingUpgrade = false;
  nextUpgrade = 45;
  nextDrop = 25;
  nextHazard = 12;
  supplyId = 0;
  constructor(seed: string, commander = "warlord") {
    const settings: Settings = {
      ...defaults,
      size: 24,
      seed,
      players: 4,
      water: 0,
      roughness: 0,
      camps: 0,
      objectives: 1,
      weirdness: 0,
      resources: 1,
      faction: "ironhold",
      commander,
      difficulty: "Normal",
      personality: "Adaptive",
      mode: "Rush Arena",
      scale: "Quick",
      starting: 0,
      population: 50,
      speed: 1,
      teams: [0, 1, 2, 3],
    };
    const map: MapData = {
      version: 1,
      settings,
      tiles: Array(24 * 24).fill(0),
      points: [
        { x: 12, y: 12, kind: "gold", owner: -1, progress: 0 },
        { x: 12, y: 12, kind: "wood", owner: -1, progress: 0 },
      ],
      spawns: [
        { x: 12, y: 18 },
        { x: 6, y: 12 },
        { x: 12, y: 6 },
        { x: 18, y: 12 },
      ],
    };
    super(settings, map);
    this.map.points = [];
    this.entities = [];
    this.players.forEach((p, team) => {
      p.faction = "ironhold";
      p.commander =
        team === 0 ? commander : ["warlord", "ranger", "engineer"][team - 1];
      const point = map.spawns[team];
      this.spawn(p.commander, team, point.x, point.y);
      for (let i = 0; i < 4; i++)
        this.reinforce(team, i % 2 ? "archer" : "swordsman");
    });
    for (let i = 0; i < 6; i++) this.drop();
    this.updateVision();
    this.objective =
      "Last commander standing. Collect supplies; stay inside the bright ring.";
  }
  get radius() {
    return 9.5 - 8 * Math.min(1, this.time / this.duration);
  }
  hero(team: number) {
    return this.entities.find((e) => e.team === team && commanders[e.kind]);
  }
  reinforce(team: number, kind: string) {
    const hero = this.hero(team) ?? this.map.spawns[team];
    const p = this.freeNear(hero);
    const e = this.spawn(kind, team, p.x, p.y);
    if (team === 0) {
      e.maxHp *= Math.pow(1.2, this.armorLevel);
      e.hp = e.maxHp;
    }
    this.events.push({
      type: "spawn",
      source: e.id,
      sourceKind: kind,
      x: e.x,
      y: e.y,
      team,
    });
    return e;
  }
  drop() {
    if (this.supplies.length >= 6) return;
    const angle = this.random() * Math.PI * 2;
    const radius = Math.sqrt(this.random()) * Math.max(0.5, this.radius - 1.4);
    this.supplies.push({
      id: ++this.supplyId,
      x: 12 + Math.cos(angle) * radius,
      y: 12 + Math.sin(angle) * radius,
      kind: ["heal", "escort", "charge"][this.supplyId % 3] as Supply["kind"],
    });
  }
  override updateVision() {
    this.visible = this.players.map(() => Array(this.map.tiles.length).fill(1));
    this.explored = this.players.map(() =>
      Array(this.map.tiles.length).fill(1),
    );
  }
  override execute(order: Order) {
    if (["Build", "Recruit", "Research", "Capture"].includes(order.type))
      return;
    return super.execute(order);
  }
  override setPause() {
    if (this.pendingUpgrade) return false;
    return super.setPause();
  }
  override hit(a: Entity, b: Entity, base?: number) {
    super.hit(a, b, base);
    if (b.hp <= 0) b.respawn = undefined;
  }
  override ai() {
    for (let team = 0; team < 4; team++) {
      const hero = this.hero(team);
      if (!hero || hero.hp <= 0) continue;
      const threatened = this.hazards.some(
        (h) => dist(hero, h) < h.radius + 0.5,
      );
      let destination: Point | undefined;
      if (dist(hero, this.center) > this.radius - 1 || threatened)
        destination = this.center;
      if (team !== 0 && !destination) {
        const supply = this.supplies.find((s) => dist(s, hero) < 4);
        const enemy = this.entities
          .filter((e) => e.hp > 0 && e.team !== team && commanders[e.kind])
          .sort((a, b) => dist(hero, a) - dist(hero, b))[0];
        destination = supply ?? enemy;
      }
      for (const e of this.entities.filter(
        (e) => e.team === team && e.hp > 0,
      )) {
        // Player movement remains in the player's hands. Escorts keep up automatically.
        if (team === 0) {
          if (e !== hero && dist(e, hero) > 4.5)
            this.execute({
              type: "AttackMove",
              team,
              ids: [e.id],
              x: hero.x,
              y: hero.y,
            });
        } else if (destination)
          this.execute({
            type: "AttackMove",
            team,
            ids: [e.id],
            x: destination.x,
            y: destination.y,
          });
      }
      if (
        team !== 0 &&
        this.entities.some(
          (e) => e.hp > 0 && e.team !== team && dist(e, hero) < 4,
        )
      )
        this.execute({
          type: "UseAbility",
          team,
          ids: [hero.id],
          slot: Math.floor(this.time / 5) % 3,
        });
    }
  }
  chooseUpgrade(kind: ArenaUpgrade) {
    if (!this.pendingUpgrade || !(kind in arenaUpgrades)) return false;
    if (kind === "escort") {
      for (const k of ["archer", "archer", "swordsman", "swordsman"])
        this.reinforce(0, k);
    }
    if (kind === "armor") {
      this.armorLevel++;
      this.entities
        .filter((e) => e.team === 0 && e.hp > 0)
        .forEach((e) => {
          e.maxHp *= 1.2;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.35);
        });
    }
    if (kind === "charge") this.charge(0, 45);
    this.upgrades++;
    this.pendingUpgrade = false;
    this.paused = false;
    this.events.push({
      type: "notice",
      text: arenaUpgrades[kind].name + " acquired.",
    });
    return true;
  }
  charge(team: number, seconds: number) {
    this.entities
      .filter((e) => e.team === team && e.hp > 0)
      .forEach((e) => {
        e.buff = Math.max(e.buff, seconds);
        if (commanders[e.kind]) e.abilities = [0, 0, 0];
      });
  }
  hurt(e: Entity, damage: number) {
    if (e.hp <= 0) return;
    e.hp = Math.max(0, e.hp - damage);
    if (!e.hp) {
      e.respawn = undefined;
      this.events.push({
        type: "death",
        x: e.x,
        y: e.y,
        team: e.team,
        target: e.id,
        targetKind: e.kind,
      });
    }
  }
  override step(dt = 0.1) {
    if (this.paused || this.winner !== null || !Number.isFinite(dt) || dt <= 0)
      return;
    super.step(dt);
    if (this.winner !== null) return;
    for (const e of this.entities)
      if (dist(e, this.center) > this.radius)
        this.hurt(e, dt * (12 + (28 * this.time) / this.duration));
    for (const hazard of this.hazards.filter((h) => h.at <= this.time)) {
      this.entities
        .filter((e) => dist(e, hazard) < hazard.radius)
        .forEach((e) => this.hurt(e, commanders[e.kind] ? 65 : 45));
      this.events.push({
        type: "ability",
        sound: "hit",
        x: hazard.x,
        y: hazard.y,
      });
    }
    this.hazards = this.hazards.filter((h) => h.at > this.time);
    if (this.time >= this.nextHazard) {
      this.nextHazard += 18;
      const hero = this.hero(0)!;
      this.hazards.push({
        x: hero.x,
        y: hero.y,
        at: this.time + 2.5,
        radius: 1.8,
      });
      this.events.push({
        type: "notice",
        text: "Incoming strike! Move out of the red warning circle.",
      });
    }
    for (const cache of [...this.supplies]) {
      const hero = this.entities.find(
        (e) => e.hp > 0 && commanders[e.kind] && dist(e, cache) < 1.1,
      );
      if (!hero) continue;
      this.collected[hero.team]++;
      if (cache.kind === "heal")
        this.entities
          .filter((e) => e.team === hero.team && e.hp > 0)
          .forEach((e) => (e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.4)));
      if (cache.kind === "escort")
        for (let i = 0; i < 2; i++)
          this.reinforce(hero.team, i ? "archer" : "swordsman");
      if (cache.kind === "charge") this.charge(hero.team, 12);
      this.supplies = this.supplies.filter((s) => s.id !== cache.id);
      this.events.push({
        type: "capture",
        sound: "collect",
        x: cache.x,
        y: cache.y,
        team: hero.team,
        text:
          cache.kind === "heal"
            ? "Medical cache: squad healed."
            : cache.kind === "escort"
              ? "Escort cache: two reinforcements."
              : "Energy cache: abilities refreshed.",
      });
    }
    this.supplies = this.supplies.filter(
      (s) => dist(s, this.center) <= this.radius + 0.5,
    );
    if (this.time >= this.nextDrop) {
      this.nextDrop += 25;
      for (let i = 0; i < 3; i++) this.drop();
    }
    this.players.forEach((p) => {
      p.gold = 0;
      p.wood = 0;
    });
    this.checkVictory();
    if (
      this.winner === null &&
      this.time >= this.nextUpgrade &&
      this.nextUpgrade < this.duration
    ) {
      this.nextUpgrade += 45;
      this.pendingUpgrade = true;
      this.paused = true;
    }
    this.objective = `${this.players.filter((p) => p.alive).length} commanders remain · Ring radius ${this.radius.toFixed(1)} · Red circles warn before strikes`;
  }
  override checkVictory() {
    // Commander defeat permanently eliminates that squad in this mode.
    this.players.forEach((p, team) => {
      const hero = this.hero(team);
      if (!hero || hero.hp <= 0) {
        p.alive = false;
        this.entities
          .filter((e) => e.team === team)
          .forEach((e) => {
            e.hp = 0;
            e.respawn = undefined;
          });
      }
    });
    const alive = this.players
      .map((p, team) => ({ p, team }))
      .filter((v) => v.p.alive);
    if (!this.players[0].alive) this.finish(alive[0]?.team ?? 1);
    else if (alive.length === 1) this.finish(alive[0].team);
    else if (this.time >= this.duration) {
      const ranked = alive
        .map((v) => ({
          team: v.team,
          score:
            this.entities
              .filter((e) => e.team === v.team && e.hp > 0)
              .reduce((sum, e) => sum + e.hp, 0) +
            this.collected[v.team] * 80,
        }))
        .sort((a, b) => b.score - a.score || a.team - b.team);
      this.finish(ranked[0].team);
    }
  }
}
