import test from "node:test";
import assert from "node:assert/strict";
import { RushArena } from "../src/arena";

test("arena starts four readable squads without a base economy", () => {
  const a = new RushArena("arena-test");
  assert.equal(a.entities.length, 20);
  assert.equal(
    a.entities.some((e) => e.building),
    false,
  );
  a.step();
  assert.equal(a.winner, null);
  assert.equal(a.players[0].gold, 0);
  assert.equal(a.supplies.length, 6);
  assert.ok(a.visible[0].every(Boolean));
  a.execute({ type: "Build", team: 0, kind: "keep", x: 10, y: 10 });
  assert.equal(a.entities.length, 20);
});
test("finite cache heals once and disappears", () => {
  const a = new RushArena("cache");
  a.ai = () => {};
  const hero = a.hero(0)!;
  hero.hp = 100;
  a.supplies = [{ id: 100, kind: "heal", x: hero.x, y: hero.y }];
  a.step();
  const hp = hero.hp;
  assert.ok(hp > 100);
  assert.equal(a.supplies.length, 0);
  assert.equal(a.collected[0], 1);
  a.step();
  assert.equal(hero.hp, hp);
  assert.equal(a.collected[0], 1);
});
test("upgrade pauses time and resumes only after a valid choice", () => {
  const a = new RushArena("upgrade");
  a.ai = () => {};
  a.time = 45;
  a.step();
  assert.ok(a.pendingUpgrade);
  assert.ok(a.paused);
  const time = a.time;
  a.step();
  assert.equal(a.time, time);
  assert.equal(a.chooseUpgrade("invalid" as any), false);
  assert.ok(a.paused);
  const hp = a.hero(0)!.maxHp;
  assert.ok(a.chooseUpgrade("armor"));
  assert.equal(a.upgrades, 1);
  assert.equal(a.hero(0)!.maxHp, hp * 1.2);
  assert.equal(a.paused, false);
  assert.equal(a.chooseUpgrade("escort"), false);
});
test("storm shrinks, paused hazards freeze, and commander defeat eliminates squad without respawn", () => {
  const a = new RushArena("storm");
  a.ai = () => {};
  a.time = 120;
  const radius = a.radius,
    hero = a.hero(0)!;
  hero.x = 21;
  hero.y = 12;
  const hp = hero.hp;
  a.step();
  assert.ok(hero.hp < hp);
  assert.ok(a.radius < radius);
  assert.equal(a.hazards.length, 1);
  const at = a.hazards[0].at;
  a.paused = true;
  a.step();
  assert.equal(a.hazards[0].at, at);
  a.paused = false;
  a.hit(a.hero(1)!, hero, 9999);
  a.checkVictory();
  assert.equal(hero.respawn, undefined);
  assert.equal(a.players[0].alive, false);
  assert.ok(a.entities.filter((e) => e.team === 0).every((e) => e.hp <= 0));
  assert.notEqual(a.winner, 0);
});
test("surviving health and supply score resolves a four-minute arena deterministically", () => {
  const a = new RushArena("finale");
  a.collected[0] = 100;
  a.time = a.duration;
  a.checkVictory();
  assert.equal(a.winner, 0);
  const b = new RushArena("finale");
  assert.deepEqual(b.supplies, new RushArena("finale").supplies);
});
