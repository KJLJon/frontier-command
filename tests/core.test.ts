import test from "node:test";
import { daylight } from "../src/daylight";
import assert from "node:assert/strict";
import { generateMap, defaults, validateMap, path, passable } from "../src/map";
import {
  Simulation,
  combatDamage,
  migrateSave,
  type Settings,
} from "../src/simulation";
import { campaign, validateCampaign, units, biomes } from "../src/content";
import { campaigns } from "../src/campaigns";
const settings: Settings = {
  ...defaults,
  size: 24,
  faction: "ironhold",
  commander: "warlord",
  difficulty: "Normal",
  personality: "Adaptive",
  mode: "Conquest",
  scale: "Quick",
  starting: 700,
  population: 60,
  speed: 1,
  teams: [0, 1],
  aiOnly: true,
};
test("same version, seed, and settings reproduce every tile and point", () => {
  assert.deepEqual(generateMap(defaults), generateMap(defaults));
  assert.notDeepEqual(
    generateMap(defaults),
    generateMap({ ...defaults, seed: "OTHER" }),
  );
});
test("many deterministic maps satisfy spawn, resources and objective invariants", () => {
  for (let i = 0; i < 200; i++) {
    const m = generateMap({
      ...defaults,
      seed: "TEST-" + i,
      size: [24, 36, 48, 56][i % 4],
      players: 2 + (i % 5),
      biome: Object.keys(biomes)[i % 4],
      roughness: (i % 10) / 10,
      water: (i % 5) / 10,
    });
    assert.deepEqual(validateMap(m), [], m.settings.seed);
  }
});
test("pathfinding routes around blocked terrain", () => {
  const m = generateMap({ ...defaults, size: 24 });
  const route = path(m, m.spawns[0], m.spawns[1]);
  assert.ok(route.length > 0);
  assert.ok(route.every((p) => passable(m, p.x, p.y)));
});
test("campaign connections and structured content validate", () => {
  assert.deepEqual(validateCampaign(campaign), []);
  assert.ok(validateCampaign({ ...campaign, faction: "invalid" }).length);
});
test("spears and siege have meaningful counters", () => {
  const s = new Simulation(settings);
  const spear = s.spawn("spearman", 0, 2, 2),
    horse = s.spawn("cavalry", 1, 3, 3),
    sword = s.spawn("swordsman", 1, 3, 3),
    siege = s.spawn("siege", 0, 2, 2),
    keep = s.entities.find((e) => e.kind === "keep")!;
  assert.ok(
    combatDamage(spear, horse, s.players) >
      combatDamage(spear, sword, s.players),
  );
  assert.ok(combatDamage(siege, keep, s.players) > units.siege.damage * 2);
});
test("construction consumes resources and increases population only when complete", () => {
  const s = new Simulation(settings),
    p = s.map.spawns[0];
  const before = s.players[0].wood,
    cap = s.capacity(0);
  s.execute({ type: "Build", team: 0, kind: "house", x: p.x + 3, y: p.y + 2 });
  assert.equal(s.players[0].wood, before - 65);
  assert.equal(s.capacity(0), cap);
  s.players.forEach((p) => (p.ai = false));
  for (let i = 0; i < 130; i++) s.step();
  assert.equal(s.capacity(0), cap + 8);
  assert.ok(s.players[0].gold > settings.starting);
});
test("recruitment checks prerequisites and population and completes queues", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  const p = s.map.spawns[0];
  s.execute({ type: "Recruit", team: 0, kind: "archer" });
  assert.equal(s.entities.filter((e) => e.kind === "archer").length, 0);
  s.spawn("range", 0, p.x + 3, p.y, true);
  s.execute({ type: "Recruit", team: 0, kind: "archer" });
  for (let i = 0; i < 100; i++) s.step();
  assert.equal(
    s.entities.filter((e) => e.kind === "archer" && e.team === 0).length,
    1,
  );
});
test("research changes combat and cannot be purchased twice", () => {
  const s = new Simulation(settings),
    p = s.map.spawns[0];
  s.spawn("blacksmith", 0, p.x + 3, p.y, true);
  const a = s.entities.find((e) => e.team === 0 && e.kind === "swordsman")!,
    b = s.entities.find((e) => e.team === 1 && e.kind === "swordsman")!,
    before = combatDamage(a, b, s.players);
  s.execute({ type: "Research", team: 0, kind: "weapons" });
  assert.equal(combatDamage(a, b, s.players), before * 1.25);
  const gold = s.players[0].gold;
  s.execute({ type: "Research", team: 0, kind: "weapons" });
  assert.equal(s.players[0].gold, gold);
});
test("tactical pause queues commands without advancing simulation", () => {
  const s = new Simulation(settings);
  s.setPause();
  s.issue({ type: "UseAbility", team: 0, slot: 2 });
  s.step();
  assert.equal(s.time, 0);
  assert.equal(s.commands.length, 1);
  s.setPause();
  s.step();
  assert.equal(s.commands.length, 0);
  assert.ok(
    s.entities.find((e) => e.team === 0 && e.kind === "warlord")!.abilities[2] >
      0,
  );
});
test("save restore resumes an identical command world", () => {
  const s = new Simulation(settings);
  for (let i = 0; i < 200; i++) s.step();
  const restored = Simulation.restore(s.serialize());
  assert.equal(restored.serialize(), s.serialize());
  for (let i = 0; i < 100; i++) {
    s.step();
    restored.step();
  }
  assert.equal(restored.serialize(), s.serialize());
});
test("migration preserves existing state and rejects future formats", () => {
  assert.equal(
    migrateSave({
      schema: 1,
      map: {},
      settings: {},
      entities: [],
      players: [],
      time: 0,
    }).schema,
    2,
  );
  assert.throws(() => migrateSave({ schema: 99 }), /preserved/);
  assert.throws(() => Simulation.restore("{}"));
  const corrupt = JSON.parse(new Simulation(settings).serialize());
  corrupt.entities[0].kind = "unknown";
  assert.throws(() => Simulation.restore(JSON.stringify(corrupt)), /preserved/);
});
test("conquest ends when a rival keep is destroyed", () => {
  const s = new Simulation(settings);
  s.entities
    .filter((e) => e.team === 1 && e.kind === "keep")
    .forEach((e) => (e.hp = 0));
  s.step();
  assert.equal(s.winner, 0);
});
test("domination and relic scoring produce victory", () => {
  for (const mode of ["Domination", "Relic Hunt"]) {
    const s = new Simulation({ ...settings, mode });
    s.players[0].score = 1001;
    s.step();
    assert.equal(s.winner, 0);
  }
});
test("AI builds armies, expands and attacks; accelerated matches terminate", () => {
  for (const personality of [
    "Aggressive",
    "Defensive",
    "Economic",
    "Raider",
    "Expansionist",
    "Adaptive",
  ]) {
    const s = new Simulation({ ...settings, personality, seed: personality });
    for (let i = 0; i < 10000 && s.winner === null; i++) s.step();
    assert.notEqual(s.winner, null, personality);
    assert.ok(s.nextId > 30, "AI recruited and built");
    assert.ok(
      s.entities.some((e) => e.kind === "barracks"),
      "AI built production",
    );
    assert.ok(s.players.every((p) => p.gold >= 0 && p.wood >= 0));
    assert.ok(
      s.entities.some((e) => e.kind === "keep" && e.hp < e.maxHp) ||
        s.players.some((p) => !p.alive),
      "AI attacked",
    );
  }
});
test("every registered campaign validates", () => {
  for (const c of campaigns) assert.deepEqual(validateCampaign(c), []);
});
test("competitive two-player maps are rotationally fair", () => {
  for (let i = 0; i < 40; i++) {
    const m = generateMap({
      ...defaults,
      preset: "Competitive",
      seed: "FAIR-" + i,
    });
    const n = m.settings.size;
    assert.equal(m.spawns[0].x + m.spawns[1].x, n - 1);
    for (let j = 0; j < m.tiles.length; j++)
      assert.equal(m.tiles[j], m.tiles[m.tiles.length - 1 - j]);
    assert.deepEqual(validateMap(m), []);
  }
});
test("fog hides distant enemies until scouting", () => {
  const s = new Simulation(settings),
    enemy = s.entities.find((e) => e.team === 1 && e.kind === "keep")!;
  const i = Math.floor(enemy.y) * settings.size + Math.floor(enemy.x);
  assert.equal(s.visible[0][i], 0);
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  hero.x = enemy.x - 2;
  hero.y = enemy.y;
  s.updateVision();
  assert.equal(s.visible[0][i], 1);
  hero.x = 2;
  hero.y = 2;
  s.updateVision();
  assert.equal(s.visible[0][i], 0);
  assert.equal(s.explored[0][i], 1);
});
test("Hard limits pause and Brutal disables it", () => {
  const s = new Simulation({ ...settings, difficulty: "Hard" });
  for (let i = 0; i < 3; i++) {
    s.setPause();
    assert.ok(s.paused);
    s.setPause();
  }
  s.setPause();
  assert.equal(s.paused, false);
  const b = new Simulation({ ...settings, difficulty: "Brutal" });
  b.setPause();
  assert.equal(b.paused, false);
});
test("structured mission actions fire once and survive saves", () => {
  const mission = {
    ...campaign.missions[0],
    triggers: [
      {
        when: "time" as const,
        value: 0.2,
        actions: [
          { type: "resources" as const, gold: 123, wood: 100 },
          { type: "objective" as const, text: "A new objective" },
        ],
      },
    ],
  };
  const s = new Simulation({ ...settings, mission });
  s.players.forEach((p) => (p.ai = false));
  s.step();
  s.step();
  assert.deepEqual(s.triggers, [0]);
  assert.equal(s.objective, "A new objective");
  const restored = Simulation.restore(s.serialize());
  for (let i = 0; i < 10; i++) restored.step();
  assert.deepEqual(restored.triggers, [0]);
});
test("survival waves escalate and the final timer produces a win", () => {
  const s = new Simulation({ ...settings, mode: "Survival" });
  s.players.forEach((p) => (p.ai = false));
  s.entities
    .filter((e) => e.kind === "keep")
    .forEach((e) => (e.hp = e.maxHp = 1e9));
  for (let i = 0; i < 6100 && s.winner === null; i++) s.step();
  assert.equal(s.wave, 12);
  assert.equal(s.winner, 0);
});

test("invalid ability slots and repeated lethal hits do not corrupt state", () => {
  const s = new Simulation(settings);
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  const target = s.spawn("swordsman", 1, hero.x + 1, hero.y);
  s.execute({ type: "UseAbility", team: 0, slot: 9 });
  assert.equal(hero.abilities.length, 3);
  const before = s.stats.kills;
  s.hit(hero, target, 10000);
  s.hit(hero, target, 10000);
  assert.equal(s.stats.kills, before + 1);
  assert.ok(s.events.find((e) => e.type === "hit" && e.damage === 10000));
});

test("attack-move resumes its saved destination after an engagement", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  s.map.tiles.fill(0);
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  hero.x = 8.5;
  hero.y = 8.5;
  s.execute({ type: "AttackMove", team: 0, ids: [hero.id], x: 13.5, y: 8.5 });
  hero.pursuing = true;
  hero.route = [];
  const restored = Simulation.restore(s.serialize());
  for (let i = 0; i < 50; i++) restored.step();
  const moved = restored.entities.find((e) => e.id === hero.id)!;
  assert.ok(moved.x > 12);
  assert.deepEqual(moved.destination, { x: 13.5, y: 8.5 });
});

test("melee attackers approach and damage buildings rather than their blocked tile", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  s.map.tiles.fill(0);
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  hero.x = 8.5;
  hero.y = 8.5;
  const tower = s.spawn("house", 1, 12.5, 8.5, true);
  const before = tower.hp;
  s.execute({ type: "Attack", team: 0, ids: [hero.id], target: tower.id });
  for (let i = 0; i < 90; i++) s.step();
  assert.ok(tower.hp < before);
});

test("finite deposits award exactly the remainder and stay depleted after saving", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  const mine = s.map.points.find((p) => p.kind === "gold" && p.owner === 0)!;
  s.map.points
    .filter((p) => p.owner === 0 && p.kind === "gold")
    .forEach((p) => (p.remaining = 0));
  mine.remaining = 0.01;
  s.step();
  assert.equal(mine.remaining, 0);
  assert.equal(s.events.filter((e) => e.type === "depleted").length, 1);
  const restored = Simulation.restore(s.serialize());
  assert.equal(
    restored.map.points.find((p) => p.x === mine.x && p.y === mine.y)!
      .remaining,
    0,
  );
  restored.step();
  assert.equal(restored.events.filter((e) => e.type === "depleted").length, 0);
});

test("capture progress belongs to its claimant and cannot be stolen by a new team", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  const point = s.map.points.find((p) => p.kind === "relic")!;
  s.entities
    .filter((e) => !e.building)
    .forEach((e) => {
      e.x = 1;
      e.y = 1;
    });
  const unit = s.spawn("spearman", 0, point.x, point.y);
  point.owner = -1;
  point.progress = 5.9;
  point.claimant = 1;
  s.step();
  assert.equal(point.owner, -1);
  assert.equal(point.claimant, 0);
  assert.ok(point.progress < 1);
  assert.equal(unit.hp > 0, true);
});

test("commander respawn clears pursuit, steering, and hostile effects", () => {
  const s = new Simulation(settings);
  s.players.forEach((p) => (p.ai = false));
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  hero.hp = 0;
  hero.respawn = 0.05;
  hero.order = "Attack";
  hero.target = 999;
  hero.slow = 30;
  hero.steer = { dx: 1, dy: 0, remaining: 5 };
  hero.destination = { x: 20, y: 20 };
  s.step();
  assert.equal(hero.hp, hero.maxHp);
  assert.equal(hero.order, "Hold");
  assert.equal(hero.target, undefined);
  assert.equal(hero.steer, undefined);
  assert.equal(hero.destination, undefined);
  assert.equal(hero.slow, 0);
});

test("day-night lighting is cyclic, bounded and follows saved simulation time", () => {
  assert.equal(daylight(0).phase, "Day");
  assert.equal(daylight(120).phase, "Night");
  assert.ok(daylight(120).night > 0.4);
  assert.deepEqual(daylight(240), daylight(0));
  for (let t = 0; t < 480; t++)
    assert.ok(daylight(t).night >= 0 && daylight(t).night <= 1);
  const s = new Simulation(settings);
  s.time = 120;
  s.paused = true;
  s.step();
  assert.deepEqual(
    daylight(Simulation.restore(s.serialize()).time),
    daylight(s.time),
  );
});

// These checks exercise the beginner flow without a renderer.
import { buildingChoices, recruitmentProblem, nextStep } from "../src/advisor";
test("building catalog orders prerequisites first and explains missing resources", () => {
  const s = new Simulation({ ...settings, aiOnly: false });
  const kinds = buildingChoices(s).map((c) => c.kind);
  assert.ok(kinds.indexOf("barracks") < kinds.indexOf("blacksmith"));
  assert.ok(kinds.indexOf("blacksmith") < kinds.indexOf("workshop"));
  assert.ok(kinds.indexOf("blacksmith") < kinds.indexOf("arcane"));
  s.players[0].gold = 0;
  s.players[0].wood = 0;
  assert.match(
    buildingChoices(s).find((c) => c.kind === "barracks")!.need,
    /gold.*wood/,
  );
  assert.match(recruitmentProblem(s, "swordsman"), /Barracks/);
});
test("guided opening progresses through construction, training and emergency retreat", () => {
  const s = new Simulation({ ...settings, aiOnly: false }),
    p = s.map.spawns[0];
  assert.match(nextStep(s).title, /1\. Build/);
  const b = s.spawn("barracks", 0, p.x + 3, p.y, true, true);
  assert.match(nextStep(s).title, /ready in/);
  b.build = 0;
  assert.match(nextStep(s).title, /2\. Train/);
  s.stats.recruited = 3;
  assert.match(nextStep(s).title, /Watchtower/);
  const hero = s.entities.find((e) => e.team === 0 && e.kind === "warlord")!;
  hero.hp = hero.maxHp * 0.2;
  assert.equal(nextStep(s).action, "guide:retreat");
});
test("opening preparation prevents offensive AI raids but still permits base defense", () => {
  const s = new Simulation({ ...settings, aiOnly: false, preparation: 180 }),
    base = s.map.spawns[1];
  s.players[1].personality = "Adaptive";
  for (let i = 0; i < 14; i++) s.spawn("swordsman", 1, base.x + 2, base.y + 2);
  s.time = 1;
  s.players[1].nextAI = 0;
  s.ai();
  assert.equal(s.players[1].plan, "Prepare defenses; no opening raid");
  s.time = 181;
  s.players[1].nextAI = 0;
  s.ai();
  assert.equal(s.players[1].plan, "Attack enemy headquarters");
  const restored = new Simulation({
    ...settings,
    aiOnly: false,
    preparation: 180,
  });
  assert.equal(restored.preparationRemaining, 180);
  assert.equal(
    new Simulation({ ...settings, preparation: 180 }).preparationRemaining,
    0,
  );
});
test("guarding player troops stay home until given an explicit pursuit order", () => {
  const s = new Simulation({ ...settings, aiOnly: false });
  s.entities = s.entities.filter((e) => e.building);
  s.map.tiles.fill(0);
  s.players.forEach((p) => (p.ai = false));
  const a = s.spawn("swordsman", 0, 10.5, 10.5),
    b = s.spawn("swordsman", 1, 13.5, 10.5);
  b.order = "Hold";
  const start = { x: a.x, y: a.y };
  for (let i = 0; i < 20; i++) s.step(0.05);
  assert.deepEqual({ x: a.x, y: a.y }, start);
  s.execute({ type: "Attack", team: 0, ids: [a.id], target: b.id });
  for (let i = 0; i < 30; i++) s.step(0.05);
  assert.ok(a.x > start.x);
});
