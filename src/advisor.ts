import {
  buildings,
  units,
  technologies,
  factions,
  commanders,
} from "./content";
import type { Simulation } from "./simulation";

export function buildingChoices(s: Simulation) {
  const priorities = [
    "barracks",
    "tower",
    "house",
    "depot",
    "range",
    "blacksmith",
    "stable",
    "workshop",
    "arcane",
    "wall",
  ];
  const depth = (kind: string): number =>
    buildings[kind].requires ? 1 + depth(buildings[kind].requires!) : 0;
  return Object.entries(buildings)
    .filter(([kind]) => kind !== "keep")
    .map(([kind, d]) => {
      const pending = s.entities.find(
        (e) => e.team === 0 && e.kind === kind && e.hp > 0 && e.build > 0,
      );
      const missing =
        d.requires && !s.has(0, d.requires) ? d.requires : undefined;
      const unlocks = [
        ...Object.entries(units)
          .filter(([, u]) => u.building === kind)
          .map(([, u]) => u.name),
        ...Object.entries(buildings)
          .filter(([, b]) => b.requires === kind)
          .map(([, b]) => b.name),
        ...Object.entries(technologies)
          .filter(([, t]) => t.requires === kind)
          .map(([, t]) => t.name),
      ];
      let priority = priorities.indexOf(kind);
      if (kind === "house" && s.capacity(0) - s.population(0) <= 2)
        priority = -2;
      if (
        kind === "blacksmith" &&
        s.has(0, "barracks") &&
        !s.has(0, "blacksmith")
      )
        priority = 2;
      const need = costShortfall(s, d.gold, d.wood);
      return {
        kind,
        definition: d,
        pending,
        missing,
        unlocks,
        need,
        priority,
        depth: depth(kind),
        built: s.has(0, kind),
      };
    })
    .sort(
      (a, b) =>
        Number(!!a.missing) - Number(!!b.missing) ||
        a.depth - b.depth ||
        a.priority - b.priority,
    );
}
export function costShortfall(s: Simulation, gold: number, wood: number) {
  const p = s.players[0],
    shortages = [];
  if (p.gold < gold) shortages.push(`${Math.ceil(gold - p.gold)} gold`);
  if (p.wood < wood) shortages.push(`${Math.ceil(wood - p.wood)} wood`);
  return shortages.length ? "Need " + shortages.join(" + ") : "";
}
export function recruitmentProblem(s: Simulation, kind: string) {
  const u = units[kind],
    cost = factions[s.players[0].faction].cost;
  if (!s.has(0, u.building)) return `Build ${buildings[u.building].name} first`;
  if (s.population(0) + u.pop > s.capacity(0))
    return "Build a House for more space";
  if (
    !s.entities.some(
      (e) =>
        e.team === 0 &&
        e.hp > 0 &&
        e.kind === u.building &&
        e.build === 0 &&
        e.queue.length < 5,
    )
  )
    return "Training queue full";
  return costShortfall(s, Math.ceil(u.gold * cost), Math.ceil(u.wood * cost));
}
export function nextStep(s: Simulation) {
  const hero = s.entities.find((e) => e.team === 0 && !!commanders[e.kind]);
  if (hero && hero.hp > 0 && hero.hp < hero.maxHp * 0.35)
    return {
      title: "Your commander needs safety",
      hint: "Return to your base with the squad.",
      label: "Retreat home",
      action: "guide:retreat",
    };
  if (s.settings.mode === "Survival" && !s.has(0, "tower"))
    return {
      title: "Protect your headquarters",
      hint: "A Watchtower fires at enemies automatically.",
      label: "Build Watchtower",
      action: "guide:tower",
    };
  const pending = s.entities.find(
    (e) => e.team === 0 && e.kind === "barracks" && e.hp > 0 && e.build > 0,
  );
  if (pending)
    return {
      title: `Barracks ready in ${Math.ceil(pending.build)}s`,
      hint: "Time runs after you finish planning.",
      label: "Explore with squad",
      action: "guide:scout",
    };
  if (!s.has(0, "barracks"))
    return {
      title: "1. Build a Barracks",
      hint: "Unlock your first defenders. Building choices pause the battle.",
      label: "Choose building",
      action: "guide:barracks",
    };
  if (s.capacity(0) - s.population(0) <= 1)
    return {
      title: "Your army needs more space",
      hint: "One House adds room for 8 more troops.",
      label: "Build House",
      action: "guide:house",
    };
  if (s.stats.recruited < 3)
    return {
      title: "2. Train three defenders",
      hint: "Swordsmen protect your commander while exploring.",
      label: "Train troops",
      action: "guide:recruit",
    };
  if (!s.has(0, "tower"))
    return {
      title: "3. Give your base a Watchtower",
      hint: "It protects home while your squad explores.",
      label: "Choose defense",
      action: "guide:tower",
    };
  return {
    title: "4. Explore together",
    hint: s.settings.mission
      ? s.objective
      : s.settings.mode === "Survival"
        ? "Defend home through 12 waves. Capture supplies between attacks."
        : ["Domination", "Relic Hunt"].includes(s.settings.mode)
          ? "Capture glowing sites to score points. Reach 1,000 to win."
          : "Capture resources, grow your squad, then attack enemy headquarters.",
    label: "Select squad",
    action: "guide:scout",
  };
}
