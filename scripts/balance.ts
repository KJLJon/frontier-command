import { Simulation, type Settings } from "../src/simulation";
import { defaults } from "../src/map";
import { personalities } from "../src/content";
for (let i = 0; i < 12; i++) {
  const settings: Settings = {
    ...defaults,
    seed: "BALANCE-" + i,
    size: 24,
    faction: ["ironhold", "wildborn", "arcanists"][i % 3],
    commander: ["warlord", "ranger", "engineer"][i % 3],
    difficulty: "Normal",
    personality: personalities[i % 6],
    mode: i % 3 ? "Conquest" : "Domination",
    scale: "Quick",
    starting: 350,
    population: 60,
    speed: 1,
    teams: [0, 1],
    aiOnly: true,
  };
  const s = new Simulation(settings);
  for (let t = 0; t < 11000 && s.winner === null; t++) s.step();
  console.log(
    JSON.stringify({
      seed: settings.seed,
      personality: settings.personality,
      mode: settings.mode,
      time: s.time,
      winner: s.winner,
      entities: s.nextId,
      armies: s.players.map((_, i) => s.population(i)),
      income: s.players.map((p) => Math.floor(p.gold)),
      buildings: s.entities.filter((e) => e.building).length,
      distribution: Object.fromEntries(
        ["swordsman", "spearman", "archer", "cavalry", "siege", "support"].map(
          (k) => [k, s.entities.filter((e) => e.kind === k).length],
        ),
      ),
    }),
  );
}
