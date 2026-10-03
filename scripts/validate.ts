import { campaigns } from "../src/campaigns";
import { validateMap } from "../src/map";
import {
  units,
  buildings,
  factions,
  commanders,
  biomes,
  technologies,
  validateCampaign,
} from "../src/content";
const errors = campaigns.flatMap((c) =>
  validateCampaign(c).map((e) => c.id + ": " + e),
);
for (const c of campaigns)
  for (const m of c.missions)
    if (m.map)
      errors.push(
        ...validateMap(m.map).map((e) => c.id + "/" + m.id + ": " + e),
      );
for (const [k, u] of Object.entries(units)) {
  if (!buildings[u.building]) errors.push(k + ": unknown production building");
  for (const v of [
    "hp",
    "damage",
    "range",
    "speed",
    "rate",
    "pop",
    "time",
    "vision",
  ] as const)
    if (!Number.isFinite(u[v]) || u[v] <= 0) errors.push(k + ": invalid " + v);
  if (u.gold < 0 || u.wood < 0) errors.push(k + ": negative cost");
}
for (const [k, b] of Object.entries(buildings)) {
  if (b.requires && !buildings[b.requires])
    errors.push(k + ": missing prerequisite");
  if (b.hp <= 0 || b.time <= 0 || b.gold < 0 || b.wood < 0)
    errors.push(k + ": invalid building values");
}
for (const [k, t] of Object.entries(technologies))
  if (!buildings[t.requires] || t.gold < 0 || t.wood < 0)
    errors.push(k + ": invalid technology");
for (const [k, f] of Object.entries(factions))
  if (
    [f.hp, f.speed, f.cost, f.income].some((v) => v <= 0 || !Number.isFinite(v))
  )
    errors.push(k + ": invalid faction modifiers");
for (const [k, c] of Object.entries(commanders))
  if (c.abilities.length !== 3 || c.hp <= 0 || c.speed <= 0)
    errors.push(k + ": invalid commander");
for (const [k, b] of Object.entries(biomes))
  if ([b.slow, b.vision, b.resource].some((v) => v <= 0))
    errors.push(k + ": invalid biome");
if (errors.length) throw Error(errors.join("\n"));
console.log(
  `Content valid: ${campaigns.length} campaigns, ${Object.keys(units).length} units, ${Object.keys(buildings).length} structures.`,
);
