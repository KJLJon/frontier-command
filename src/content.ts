import type { MapData } from "./map";
export type UnitDef = {
  name: string;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  rate: number;
  gold: number;
  wood: number;
  pop: number;
  time: number;
  building: string;
  tag: string;
  vision: number;
};
export const units: Record<string, UnitDef> = {
  swordsman: {
    name: "Swordsman",
    hp: 110,
    damage: 14,
    range: 1.1,
    speed: 2,
    rate: 1,
    gold: 45,
    wood: 0,
    pop: 1,
    time: 8,
    building: "barracks",
    tag: "infantry",
    vision: 5,
  },
  spearman: {
    name: "Spearman",
    hp: 90,
    damage: 12,
    range: 1.5,
    speed: 2.1,
    rate: 1.1,
    gold: 35,
    wood: 15,
    pop: 1,
    time: 7,
    building: "barracks",
    tag: "spear",
    vision: 5,
  },
  archer: {
    name: "Archer",
    hp: 65,
    damage: 10,
    range: 5,
    speed: 2.1,
    rate: 1.2,
    gold: 35,
    wood: 30,
    pop: 1,
    time: 9,
    building: "range",
    tag: "ranged",
    vision: 7,
  },
  cavalry: {
    name: "Cavalry",
    hp: 170,
    damage: 21,
    range: 1.3,
    speed: 3.3,
    rate: 1.2,
    gold: 90,
    wood: 20,
    pop: 2,
    time: 14,
    building: "stable",
    tag: "cavalry",
    vision: 7,
  },
  siege: {
    name: "Runic Catapult",
    hp: 130,
    damage: 42,
    range: 7,
    speed: 1.1,
    rate: 3,
    gold: 130,
    wood: 100,
    pop: 3,
    time: 22,
    building: "workshop",
    tag: "siege",
    vision: 6,
  },
  support: {
    name: "Dawnweaver",
    hp: 75,
    damage: 9,
    range: 4.5,
    speed: 2,
    rate: 1.5,
    gold: 90,
    wood: 35,
    pop: 2,
    time: 15,
    building: "arcane",
    tag: "support",
    vision: 6,
  },
};
export type BuildingDef = {
  name: string;
  hp: number;
  gold: number;
  wood: number;
  time: number;
  requires?: string;
  pop?: number;
  range?: number;
  damage?: number;
  description: string;
};
export const buildings: Record<string, BuildingDef> = {
  keep: {
    name: "Command Keep",
    hp: 2200,
    gold: 350,
    wood: 300,
    time: 45,
    pop: 12,
    range: 6,
    damage: 20,
    description: "Your headquarters. Lose every keep and your army falls.",
  },
  house: {
    name: "House",
    hp: 320,
    gold: 0,
    wood: 65,
    time: 12,
    pop: 8,
    description: "+8 population capacity.",
  },
  barracks: {
    name: "Barracks",
    hp: 700,
    gold: 30,
    wood: 120,
    time: 20,
    description: "Recruit swordsmen and spearmen.",
  },
  range: {
    name: "Archery Range",
    hp: 550,
    gold: 50,
    wood: 140,
    time: 22,
    description: "Recruit archers.",
  },
  stable: {
    name: "Stable",
    hp: 700,
    gold: 100,
    wood: 160,
    time: 26,
    requires: "barracks",
    description: "Recruit fast cavalry.",
  },
  workshop: {
    name: "Workshop",
    hp: 800,
    gold: 170,
    wood: 220,
    time: 32,
    requires: "blacksmith",
    description: "Recruit siege weapons.",
  },
  tower: {
    name: "Watchtower",
    hp: 650,
    gold: 80,
    wood: 100,
    time: 22,
    range: 7,
    damage: 15,
    description: "Attacks enemies and scouts the frontier.",
  },
  depot: {
    name: "Resource Depot",
    hp: 450,
    gold: 40,
    wood: 90,
    time: 18,
    description: "Nearby captured resources produce 40% more.",
  },
  blacksmith: {
    name: "Blacksmith",
    hp: 650,
    gold: 100,
    wood: 150,
    time: 25,
    requires: "barracks",
    description: "Unlocks military research and siege.",
  },
  arcane: {
    name: "Arcane Hall",
    hp: 600,
    gold: 160,
    wood: 170,
    time: 28,
    requires: "blacksmith",
    description: "Recruit healing Dawnweavers.",
  },
  wall: {
    name: "Palisade",
    hp: 950,
    gold: 0,
    wood: 35,
    time: 8,
    description: "Blocks movement. Place carefully.",
  },
};
export const factions: Record<
  string,
  {
    name: string;
    color: string;
    mark: string;
    description: string;
    hp: number;
    speed: number;
    cost: number;
    income: number;
  }
> = {
  ironhold: {
    name: "Ironhold",
    color: "#63cbea",
    mark: "◆",
    description: "Armored infantry and enduring fortifications. +15% health.",
    hp: 1.15,
    speed: 1,
    cost: 1,
    income: 1,
  },
  wildborn: {
    name: "Wildborn",
    color: "#f4a460",
    mark: "▲",
    description: "Swift raiders. +15% movement, 10% cheaper recruitment.",
    hp: 1,
    speed: 1.15,
    cost: 0.9,
    income: 1,
  },
  arcanists: {
    name: "Arcanists",
    color: "#c6a0ff",
    mark: "✦",
    description:
      "Magical engineers. +15% income; support attacks slow enemies.",
    hp: 1,
    speed: 1,
    cost: 1,
    income: 1.15,
  },
};
export const commanders: Record<
  string,
  {
    name: string;
    hp: number;
    damage: number;
    range: number;
    speed: number;
    vision: number;
    abilities: string[];
    description: string;
  }
> = {
  warlord: {
    name: "Warlord",
    hp: 650,
    damage: 30,
    range: 1.5,
    speed: 3.6,
    vision: 8,
    abilities: ["Charge", "Rally", "Iron resolve"],
    description: "Charge into battle, rally allies, and withstand the storm.",
  },
  ranger: {
    name: "Ranger",
    hp: 400,
    damage: 24,
    range: 6,
    speed: 4,
    vision: 11,
    abilities: ["Dodge", "Snare field", "Volley"],
    description: "Scout farther, slip away, and control enemy movement.",
  },
  engineer: {
    name: "Engineer",
    hp: 480,
    damage: 18,
    range: 4,
    speed: 3.2,
    vision: 8,
    abilities: ["Deploy turret", "Repair pulse", "Siege blast"],
    description: "Raise defenses, repair your army, and shatter structures.",
  },
};
export const biomes: Record<
  string,
  {
    name: string;
    ground: string;
    light: string;
    forest: string;
    water: string;
    slow: number;
    vision: number;
    resource: number;
  }
> = {
  grassland: {
    name: "Emerald March",
    ground: "#527c48",
    light: "#638f53",
    forest: "#2c593e",
    water: "#397e95",
    slow: 1,
    vision: 1,
    resource: 1,
  },
  forest: {
    name: "Whisperwood",
    ground: "#3e694d",
    light: "#507b56",
    forest: "#204b38",
    water: "#356c80",
    slow: 0.8,
    vision: 0.8,
    resource: 1.2,
  },
  snow: {
    name: "Frostfall",
    ground: "#a7c5cb",
    light: "#cee1df",
    forest: "#487b80",
    water: "#558ea9",
    slow: 0.85,
    vision: 1,
    resource: 1,
  },
  desert: {
    name: "Sunken Sands",
    ground: "#b49a62",
    light: "#c9af75",
    forest: "#74794a",
    water: "#45949b",
    slow: 1,
    vision: 1.2,
    resource: 0.85,
  },
};
export const technologies: Record<
  string,
  {
    name: string;
    gold: number;
    wood: number;
    requires: string;
    description: string;
    branch: string;
  }
> = {
  economy: {
    name: "Trade roads",
    gold: 130,
    wood: 100,
    requires: "depot",
    description: "+30% resource income.",
    branch: "Economy",
  },
  armor: {
    name: "Tempered armor",
    gold: 180,
    wood: 70,
    requires: "blacksmith",
    description: "All units take 20% less damage.",
    branch: "Military",
  },
  weapons: {
    name: "Runic steel",
    gold: 200,
    wood: 100,
    requires: "blacksmith",
    description: "+25% attack damage.",
    branch: "Military",
  },
  range: {
    name: "Eagle sight",
    gold: 150,
    wood: 130,
    requires: "range",
    description: "+1.5 ranged attack range.",
    branch: "Archery",
  },
  commander: {
    name: "Frontier legend",
    gold: 220,
    wood: 150,
    requires: "arcane",
    description: "Commander abilities recharge 30% faster.",
    branch: "Commander",
  },
  logistics: {
    name: "Field logistics",
    gold: 100,
    wood: 160,
    requires: "stable",
    description: "+15% movement speed.",
    branch: "Military",
  },
};
export const personalities = [
  "Aggressive",
  "Defensive",
  "Economic",
  "Raider",
  "Expansionist",
  "Adaptive",
];
export const scales = {
  Quick: { minutes: 10, size: 24, pop: 45, income: 1.5 },
  Standard: { minutes: 18, size: 36, pop: 75, income: 1 },
  Epic: { minutes: 40, size: 56, pop: 160, income: 0.85 },
};
export type Trigger = {
  when: "time" | "capture" | "kills" | "resources" | "region" | "destroyed";
  value: number;
  team?: number;
  region?: { x: number; y: number; r: number };
  actions: Action[];
};
export type Action = {
  type:
    | "dialogue"
    | "resources"
    | "spawn"
    | "objective"
    | "reveal"
    | "alliance"
    | "victory"
    | "defeat";
  text?: string;
  gold?: number;
  wood?: number;
  unit?: string;
  count?: number;
  team?: number;
  x?: number;
  y?: number;
  other?: number;
};
export type Mission = {
  seed?: string;
  map?: MapData;
  id: string;
  title: string;
  story: string;
  objective: string;
  mode: string;
  biome: string;
  size: number;
  difficulty: string;
  reward: number;
  next?: string;
  triggers: Trigger[];
  modifiers?: { gold?: number; wood?: number; enemyFaction?: string };
};
export type Campaign = {
  id: string;
  title: string;
  description: string;
  faction: string;
  commander: string;
  missions: Mission[];
};
export const campaign: Campaign = {
  id: "rise",
  title: "Rise of the Frontier",
  description:
    "Five chapters across a fractured kingdom. Lead Captain Elara from a lonely outpost to the gates of Ironwatch.",
  faction: "ironhold",
  commander: "warlord",
  missions: [
    {
      id: "outpost",
      title: "The Outpost",
      story:
        "Elara: The old roads are quiet. Claim the mines, raise a barracks, and give this frontier a reason to hope.",
      objective: "Claim territory and destroy the rival keep.",
      mode: "Conquest",
      biome: "grassland",
      size: 24,
      difficulty: "Easy",
      reward: 1,
      next: "line",
      triggers: [
        {
          when: "time",
          value: 30,
          actions: [
            {
              type: "dialogue",
              text: "Scout: A gold mine lies along the northern road. Stand near its banner to claim it.",
            },
          ],
        },
        {
          when: "capture",
          value: 1,
          actions: [
            { type: "resources", gold: 120, wood: 100 },
            { type: "dialogue", text: "Elara: A foothold. Now we build." },
          ],
        },
      ],
    },
    {
      id: "line",
      title: "Hold the Line",
      story:
        "Winter has closed the pass. The Wildborn are coming. Hold the beacon until reinforcements arrive.",
      objective: "Defend your keep through twelve waves.",
      mode: "Survival",
      biome: "snow",
      size: 28,
      difficulty: "Normal",
      reward: 1,
      next: "alliance",
      triggers: [
        {
          when: "time",
          value: 60,
          actions: [
            {
              type: "dialogue",
              text: "Quartermaster: Towers buy time. Dawnweavers keep soldiers alive.",
            },
            { type: "resources", gold: 180, wood: 220 },
          ],
        },
      ],
    },
    {
      id: "alliance",
      title: "Broken Alliance",
      story:
        "The Arcanists broke their oath. Three ancient shrines now decide who rules the forest.",
      objective: "Control shrines to earn 1,000 influence.",
      mode: "Domination",
      biome: "forest",
      size: 32,
      difficulty: "Normal",
      reward: 1,
      next: "siege",
      triggers: [
        {
          when: "capture",
          value: 2,
          actions: [
            {
              type: "dialogue",
              text: "Archivist: Hold the shrines. Their power grows as the conflict deepens.",
            },
          ],
        },
      ],
    },
    {
      id: "siege",
      title: "Siege of Ironwatch",
      story:
        "Beyond the dunes stands Ironwatch. Its walls have never fallen. Bring the runic engines.",
      objective: "Destroy Ironwatch’s command keep.",
      mode: "Conquest",
      biome: "desert",
      size: 36,
      difficulty: "Hard",
      reward: 2,
      next: "frontier",
      modifiers: { gold: 450, wood: 400 },
      triggers: [
        {
          when: "time",
          value: 15,
          actions: [
            { type: "resources", gold: 250, wood: 250 },
            {
              type: "dialogue",
              text: "Engineer: Build a blacksmith, then a workshop. Catapults break stone.",
            },
          ],
        },
      ],
    },
    {
      id: "frontier",
      title: "The Frontier",
      story:
        "All banners gather at the final relic. Elara: A kingdom is more than walls. Today we decide what survives.",
      objective: "Hold relics to earn 1,000 influence.",
      mode: "Relic Hunt",
      biome: "grassland",
      size: 42,
      difficulty: "Hard",
      reward: 3,
      triggers: [
        {
          when: "time",
          value: 120,
          actions: [
            { type: "spawn", unit: "cavalry", count: 3, team: 1 },
            {
              type: "dialogue",
              text: "Scout: Enemy reinforcements have crossed the ridge!",
            },
          ],
        },
      ],
    },
  ],
};
export type Achievement = {
  id: string;
  name: string;
  description: string;
  category: string;
  target: number;
  metric: string;
  hidden?: boolean;
};
export const achievements: Achievement[] = [
  ["first", "First banner", "Win your first battle.", "wins", 1],
  ["veteran", "Veteran", "Win 10 battles.", "wins", 10],
  ["legend", "Frontier legend", "Win 50 battles.", "wins", 50],
  ["slayer", "Steel and thunder", "Defeat 100 units.", "kills", 100],
  ["thousand", "A thousand foes", "Defeat 1,000 units.", "kills", 1000],
  ["builder", "Settlement", "Complete 10 buildings.", "buildings", 10],
  ["architect", "Architect", "Complete 100 buildings.", "buildings", 100],
  ["army", "Mustering call", "Recruit 50 units.", "recruited", 50],
  ["host", "Grand host", "Recruit 500 units.", "recruited", 500],
  ["gold", "Golden roads", "Collect 10,000 gold.", "gold", 10000],
  ["wood", "Timber frontier", "Collect 10,000 wood.", "wood", 10000],
  ["capture", "Claim the frontier", "Capture 25 locations.", "captures", 25],
  [
    "campaign",
    "A new kingdom",
    "Complete Rise of the Frontier.",
    "campaign",
    5,
  ],
  ["hard", "Against the odds", "Win against Hard AI.", "hard", 1],
  ["fast", "Lightning campaign", "Win in under 10 minutes.", "fast", 1],
  ["unbroken", "Unbroken", "Win without losing your commander.", "unbroken", 1],
  ["decisive", "Decisive orders", "Win without tactical pause.", "noPause", 1],
  ["huge", "Wide horizons", "Win a Huge map.", "huge", 1],
  ["horse", "Thundering hooves", "Win with mostly cavalry.", "cavalry", 1],
  [
    "explorer",
    "All roads",
    "Capture every resource point in a match.",
    "allCapture",
    1,
  ],
  ["rogue", "Beyond the border", "Complete an expedition.", "expedition", 1],
  ["research", "Scholar of war", "Research 20 technologies.", "research", 20],
  ["survive", "Last light", "Win a survival match.", "survival", 1],
  ["relic", "Ancient power", "Win Relic Hunt.", "relic", 1],
].map(([id, name, description, metric, target]) => ({
  id: String(id),
  name: String(name),
  description: String(description),
  metric: String(metric),
  target: Number(target),
  category: ["gold", "wood", "buildings", "research"].includes(String(metric))
    ? "Stewardship"
    : "Command",
  hidden: id === "legend",
}));
export function validateCampaign(c: Campaign): string[] {
  const errors: string[] = [];
  if (!c.id || !c.title || !factions[c.faction] || !commanders[c.commander])
    errors.push("Invalid campaign metadata");
  const ids = new Set(c.missions.map((m) => m.id));
  if (ids.size !== c.missions.length) errors.push("Duplicate mission IDs");
  for (const m of c.missions) {
    if (
      !biomes[m.biome] ||
      !["Conquest", "Domination", "Relic Hunt", "Survival"].includes(m.mode) ||
      m.size < 20
    )
      errors.push(`Invalid mission ${m.id}`);
    if (m.next && !ids.has(m.next)) errors.push(`Missing connection ${m.next}`);
    for (const t of m.triggers)
      for (const a of t.actions)
        if (a.type === "spawn" && !units[a.unit ?? ""])
          errors.push("Invalid spawn unit");
  }
  return errors;
}
