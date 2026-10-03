import { performance } from "node:perf_hooks";
import { Simulation, type Settings } from "../src/simulation";
import { defaults } from "../src/map";
const settings: Settings = {
  ...defaults,
  size: 56,
  players: 4,
  faction: "ironhold",
  commander: "warlord",
  difficulty: "Normal",
  personality: "Adaptive",
  mode: "Conquest",
  scale: "Epic",
  starting: 1000,
  population: 160,
  speed: 1,
  teams: [0, 1, 2, 3],
  aiOnly: true,
};
const s = new Simulation(settings);
s.players.forEach((p) => (p.ai = false));
for (let t = 0; t < 4; t++)
  for (let i = 0; i < 35; i++)
    s.spawn(
      i % 3 ? "swordsman" : "archer",
      t,
      s.map.spawns[t].x + (i % 5) * 0.3,
      s.map.spawns[t].y + Math.floor(i / 5) * 0.3,
    );
const samples: number[] = [];
for (let i = 0; i < 500; i++) {
  const start = performance.now();
  s.step();
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      entities: s.entities.filter((e) => e.hp > 0).length,
      ticks: samples.length,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95Ms: samples[Math.floor(samples.length * 0.95)],
      maxMs: samples.at(-1),
      map: "56x56",
      notes:
        "Headless CPU measurement on this workstation; not a phone GPU benchmark.",
    },
    null,
    2,
  ),
);
