import "./style.css";
import { RushArena, arenaUpgrades, type ArenaUpgrade } from "./arena";
import { daylight } from "./daylight";
import { ThemeManager, themeNames, type ThemeStyle } from "./themes";
import { Renderer } from "./renderer";
import { Simulation, type Settings, type Order } from "./simulation";
import { AudioSystem, defaultAudio, type AudioSettings } from "./audio";
import {
  units,
  buildings,
  commanders,
  factions,
  biomes,
  technologies,
  achievements,
  personalities,
  scales,
  campaign,
  validateCampaign,
  type Mission,
} from "./content";
import { campaigns } from "./campaigns";
import {
  defaults,
  generateMap,
  validateMap,
  index,
  dist,
  passable,
  type MapData,
  type Point,
} from "./map";
import {
  initStorage,
  read,
  write,
  list,
  remove,
  freshProfile,
  recordMatch,
  type Profile,
} from "./persistence";
let activeCampaign = campaigns[0];
const ui = document.querySelector<HTMLDivElement>("#ui")!,
  toastEl = document.querySelector<HTMLDivElement>("#toast")!;
const audio = new AudioSystem(),
  renderer = new Renderer();
const themes = new ThemeManager();
renderer.themes = themes;
themes.onChange = () => {
  audio.useTheme(themes.active);
  document.body.dataset.theme = themes.active?.manifest.id ?? "frontier";
  document.documentElement.style.setProperty(
    "--gold",
    themes.active?.manifest.palette.accent ?? "#e7c57b",
  );
  document
    .querySelectorAll<HTMLElement>("[data-theme-status]")
    .forEach((el) => (el.textContent = themes.status));
  decorateCommands();
  if (view === "game") updateHUD();
};
function decorateCommands() {
  const theme = themes.active;
  const mapping: Record<string, string> = {
    army: "attack",
    attackmove: "attack",
    hold: "defend",
    commander: "move",
    "panel:build": "resource",
    "panel:recruit": "attack",
    "panel:research": "ability",
  };
  document
    .querySelectorAll<HTMLButtonElement>("button[data-action]")
    .forEach((button) => {
      const action = button.dataset.action!,
        name = /^(build|recruit|research):/.test(action)
          ? action.split(":")[1]
          : action.startsWith("ability:")
            ? sim
              ? (commanders[sim.players[0].commander].abilities[
                  Number(action.split(":")[1])
                ]
                  ?.toLowerCase()
                  .replace(/ /g, "-") ?? "ability")
              : "ability"
            : mapping[action],
        url = name
          ? (theme?.icons[name] ??
            (action.startsWith("ability:") ? theme?.icons.ability : undefined))
          : undefined;
      const existing = button.querySelector<HTMLImageElement>(".theme-icon");
      if (!url) {
        existing?.remove();
        return;
      }
      if (existing?.getAttribute("src") === url) return;
      existing?.remove();
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.className = "theme-icon";
      button.prepend(image);
    });
}
async function changeTheme(id: string, style: ThemeStyle) {
  const ok = await themes.load(id, style);
  if (ok) {
    settings.theme = id;
    settings.style = style;
    await write("settings", "main", settings);
  }
  return ok;
}
let sim: Simulation | undefined,
  profile = freshProfile(),
  settings: AudioSettings = { ...defaultAudio };
let view = "menu",
  panel = "",
  mode = "Move",
  buildKind = "",
  selection: number[] = [];
let editor: MapData | undefined,
  brush = "0",
  editorTeam = 0,
  editorName = "My Frontier",
  editorSize = 32,
  editorBiome = "grassland",
  editorVictory = "Conquest";
let accumulator = 0,
  hudTime = 0,
  saveTime = 0,
  inputTime = 0,
  keys = new Set<string>(),
  ended = false,
  runBattle = false;
let toastTimer: ReturnType<typeof setTimeout>;
let deferredInstall: any;
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const button = (text: string, action: string, cls = "") =>
  `<button class="${cls}" data-action="${action}">${text}</button>`;
const options = (
  o: Record<string, { name: string }> | string[],
  current: string,
) =>
  Array.isArray(o)
    ? o
        .map(
          (v) =>
            `<option ${v === current ? "selected" : ""}>${escape(v)}</option>`,
        )
        .join("")
    : Object.entries(o)
        .map(
          ([k, v]) =>
            `<option value="${k}" ${k === current ? "selected" : ""}>${v.name}</option>`,
        )
        .join("");
const field = (name: string, label: string, body: string) =>
  `<label>${label}${body.replace("NAME", name)}</label>`;
const select = (
  name: string,
  label: string,
  o: Record<string, { name: string }> | string[],
  value: string,
) =>
  field(
    name,
    label,
    `<select name="NAME" aria-label="${escape(label)}">${options(o, value)}</select>`,
  );
const input = (
  name: string,
  label: string,
  value: unknown,
  type = "text",
  attrs = "",
) =>
  field(
    name,
    label,
    `<input name="NAME" type="${type}" value="${escape(value)}" ${attrs}>`,
  );
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4500);
}
function screen(title: string, subtitle: string, body: string, wide = false) {
  ui.innerHTML = `<div class="screen"><section class="sheet ${wide ? "wide" : ""}"><div class="screen-header"><div><div class="eyebrow">Frontier Command</div><h2>${title}</h2><div class="muted">${subtitle}</div></div>${button("Back", "back", "small")}</div>${body}</section></div>`;
}
function setView(v: string) {
  view = v;
  panel = "";
  renderer.editor = v === "editor" ? editor : undefined;
  if (v !== "game" && v !== "editor") {
    renderer.world = undefined;
    audio.state = "menu";
  }
  if (v === "menu") menu();
  if (v === "skirmish") skirmish();
  if (v === "campaign") campaignMenu();
  if (v === "expedition") expedition();
  if (v === "achievements") achievementMenu();
  if (v === "stats") statistics();
  if (v === "settings") settingsMenu();
  if (v === "credits") credits();
  if (v === "continue") void savesMenu();
  if (v === "editor") {
    if (!editor) {
      editor = generateMap({
        ...defaults,
        size: editorSize,
        biome: editorBiome,
      });
      editor.placements = [];
    }
    renderer.editor = editor;
    renderer.follow = false;
    renderer.center({
      x: editor.settings.size / 2,
      y: editor.settings.size / 2,
    });
    editorUI();
  }
  if (v === "game") {
    renderer.world = sim;
    renderer.editor = undefined;
    gameUI();
  }
}
function menu() {
  renderer.editor = undefined;
  renderer.world = undefined;
  ui.innerHTML = `<div class="menu-shade"><div class="logo"><span class="crest">◆</span> The frontier awaits</div><div class="menu-content"><div class="eyebrow">A kingdom worth fighting for</div><h1>Frontier<br>Command<span style="color:var(--gold)">.</span></h1><p>Lead from the front. Raise your banner.<br>Turn a foothold into a kingdom.</p><div class="menu-actions">${button("New skirmish", "skirmish", "primary")}${button("Rush Arena", "arena", "arena-launch")}${button("Campaign", "campaign")}${button("Expedition", "expedition")}${button("Continue", "continue")}${button("Level editor", "editor")}${button("Achievements", "achievements")}${button("Statistics", "stats")}${button("Settings", "settings")}${button("How to play", "help")}${button("Credits", "credits")}${button("Install game", "install")}</div></div><div class="menu-bottom"><span class="badge">Offline ready · Single player</span><span>v1.0 · Original art &amp; synthesized score</span></div></div>`;
}
let setup: Settings = {
  ...defaults,
  faction: "ironhold",
  commander: "warlord",
  difficulty: "Normal",
  personality: "Adaptive",
  mode: "Conquest",
  scale: "Standard",
  starting: 350,
  population: 75,
  speed: 1,
  teams: [0, 1, 2, 3, 4, 5],
};
function skirmish() {
  screen(
    "Choose your frontier",
    "A shared seed creates the same battlefield. Every rival uses the same economy.",
    `<form id="setup"><div class="form-grid">${select("faction", "Your faction", factions, setup.faction)}${select("commander", "Commander", commanders, setup.commander)}${select("scale", "Match scale", Object.keys(scales), setup.scale)}${select("size", "Map size", ["24", "28", "36", "48", "56"], " " + setup.size).replace(`value="${setup.size}"`, `value="${setup.size}"`)}${input("seed", "Map seed", setup.seed)}${select("biome", "Biome", biomes, setup.biome)}${select("players", "Players (you + AI)", ["2", "3", "4", "5", "6"], String(setup.players))}${select("difficulty", "AI difficulty", ["Easy", "Normal", "Hard", "Brutal"], setup.difficulty)}${select("personality", "AI personality", personalities, setup.personality)}${select("mode", "Victory condition", ["Conquest", "Domination", "Relic Hunt", "Survival"], setup.mode)}${select("preset", "Map preset", ["Competitive", "Balanced", "Wild", "Chaotic"], setup.preset)}${input("starting", "Starting gold & wood", setup.starting, "number", 'min="100" max="3000" step="50"')}${input("population", "Population ceiling", setup.population, "number", 'min="20" max="250"')}${select("speed", "Game speed", ["0.75", "1", "1.5", "2"], String(setup.speed))}${select("teamMode", "Teams", ["Free for all", "You vs coalition", "Two alliances"], "Free for all")}</div><details><summary>Map generation controls</summary><div class="form-grid">${input("resources", "Resource abundance", setup.resources, "range", 'min="0.5" max="2" step="0.1"')}${input("roughness", "Terrain roughness", setup.roughness, "range", 'min="0" max="1" step="0.05"')}${input("water", "Water", setup.water, "range", 'min="0" max="0.4" step="0.02"')}${input("camps", "Neutral camps", setup.camps, "number", 'min="0" max="12"')}${input("objectives", "Relic density", setup.objectives, "number", 'min="1" max="7"')}${input("weirdness", "Weirdness", setup.weirdness, "range", 'min="0" max="1" step="0.1"')}</div></details><div class="footer-actions"><div class="muted" id="setup-description">Standard · about 15–20 minutes<br>WASD to move · Space to pause</div><div class="row">${button("Copy seed", "copy-seed", "small")}<button type="submit" class="primary">Begin battle</button></div></div></form>`,
  );
  const form = document.querySelector<HTMLFormElement>("#setup")!;
  (form.elements.namedItem("size") as HTMLSelectElement).value = String(
    setup.size,
  );
  form.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.name === "scale") {
      const v = scales[target.value as keyof typeof scales];
      (form.elements.namedItem("size") as HTMLSelectElement).value = String(
        v.size,
      );
      (form.elements.namedItem("population") as HTMLInputElement).value =
        String(v.pop);
      document.querySelector("#setup-description")!.innerHTML =
        `${target.value} · about ${v.minutes} minutes<br>WASD to move · Space to pause`;
    }
    if (target.name === "preset") {
      const preset = target.value;
      const set = (k: string, v: number) =>
        ((form.elements.namedItem(k) as HTMLInputElement).value = String(v));
      set(
        "roughness",
        preset === "Competitive"
          ? 0.15
          : preset === "Wild"
            ? 0.7
            : preset === "Chaotic"
              ? 0.9
              : 0.35,
      );
      set("water", preset === "Chaotic" ? 0.3 : 0.12);
      set(
        "weirdness",
        preset === "Competitive" ? 0 : preset === "Chaotic" ? 1 : 0.2,
      );
    }
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const numerical = [
      "size",
      "players",
      "starting",
      "population",
      "speed",
      "resources",
      "roughness",
      "water",
      "camps",
      "objectives",
    ];
    setup = { ...setup, ...data } as Settings;
    for (const k of numerical) (setup as any)[k] = Number(data[k]);
    setup.teams = Array.from({ length: setup.players }, (_, i) =>
      data.teamMode === "You vs coalition"
        ? i === 0
          ? 0
          : 1
        : data.teamMode === "Two alliances"
          ? i % 2
          : i,
    );
    try {
      start(setup);
    } catch (error) {
      toast(String(error));
    }
  };
}
let suspendedBattle: Simulation | undefined;
let suspendedRunBattle = false;
function arenaMenu() {
  view = "arena-menu";
  renderer.world = undefined;
  screen(
    "Rush Arena",
    "Four commanders. One closing arena. Up to four minutes.",
    `<div class="card-grid"><article class="card"><h3>Lead your escort</h3><p>WASD or the mobile pad moves your commander. Tap to move; Q/E/R or ability buttons unleash attacks. Your escort keeps up and fights automatically.</p></article><article class="card"><h3>Race for supplies</h3><p>Walk onto a marked cache: green heals your squad, gold drops reinforcements, violet refreshes abilities. Used caches disappear.</p></article><article class="card"><h3>Stay inside the ring</h3><p>The bright boundary closes continuously. Outside it, the storm drains health. Red warning circles show strikes 2.5 seconds before impact.</p></article><article class="card"><h3>Choose your power</h3><p>Every 45 seconds, pause to choose an upgrade. Commander defeat eliminates the squad. At four minutes, surviving health plus collected supplies decides the winner.</p></article></div><div class="form-grid">${select("arenaCommander", "Arena commander", commanders, setup.commander)}${input("arenaSeed", "Arena seed", "RUSH-" + Math.floor(Date.now() / 1000))}</div><div class="footer-actions">${button("Back", suspendedBattle ? "arena-return" : "menu")}${button("Start Rush Arena", "arena-start", "primary")}</div><p class="muted">A separate single-player mini game. Campaign progress and saved RTS battles are preserved. All six worlds and three art styles work with this arena.</p>`,
  );
}
function startArena(seed: string, commander: string) {
  if (sim && !(sim instanceof RushArena) && !ended) {
    suspendedBattle = sim;
    suspendedRunBattle = runBattle;
  }
  const arena = new RushArena(seed, commander);
  sim = arena;
  runBattle = false;
  ended = false;
  accumulator = 0;
  saveTime = 0;
  keys.clear();
  selection = [arena.hero(0)!.id];
  renderer.selected = selection;
  renderer.follow = false;
  renderer.center(arena.center);
  renderer.zoom = Math.max(
    0.35,
    Math.min(1.05, window.innerWidth / 900, window.innerHeight / 570),
  );
  renderer.particles = [];
  renderer.ghosts = [];
  audio.start();
  audio.state = "combat";
  setView("game");
  toast(
    "Collect glowing supplies. Keep your commander inside the bright ring!",
  );
}
function returnFromArena() {
  if (suspendedBattle) {
    sim = suspendedBattle;
    runBattle = suspendedRunBattle;
    suspendedBattle = undefined;
    ended = false;
    renderer.selected = selection = [
      sim.entities.find((e) => e.team === 0 && commanders[e.kind])!.id,
    ];
    renderer.follow = true;
    renderer.zoom = 1;
    setView("game");
  } else {
    sim = undefined;
    ended = false;
    setView("menu");
  }
}
function start(s: Settings, map?: MapData) {
  sim = new Simulation(s, map);
  if (s.mission?.modifiers) {
    sim.players[0].gold = s.mission.modifiers.gold ?? s.starting;
    sim.players[0].wood = s.mission.modifiers.wood ?? s.starting;
  }
  if (s.bonus === "Supply wagons") {
    sim.players[0].gold += 180;
    sim.players[0].wood += 180;
  }
  if (s.bonus === "Veteran escort")
    for (let i = 0; i < 3; i++)
      sim.spawn(
        "swordsman",
        0,
        sim.map.spawns[0].x + i,
        sim.map.spawns[0].y + 2,
      );
  if (s.bonus === "Ancient knowledge") sim.players[0].tech.push("economy");
  selection = [
    sim.entities.find((e) => e.team === 0 && commanders[e.kind])!.id,
  ];
  renderer.selected = selection;
  renderer.world = sim;
  renderer.follow = true;
  renderer.editor = undefined;
  renderer.center(sim.map.spawns[0]);
  accumulator = 0;
  ended = false;
  audio.start();
  audio.state = "peace";
  setView("game");
  toast(
    s.mission?.story ??
      "Capture gold and wood banners. Build a barracks and recruit your army.",
  );
  void save("autosave", false);
}
function campaignMenu() {
  screen(
    activeCampaign.title,
    activeCampaign.description,
    `<div class="tabs">${campaigns.map((c) => button(c.title, "campaign-select:" + c.id, c.id === activeCampaign.id ? "primary" : "")).join("")}</div><div class="missions">${activeCampaign.missions
      .map((m, i) => {
        const unlocked =
          i === 0 ||
          profile.missions.includes(
            activeCampaign.id + ":" + activeCampaign.missions[i - 1].id,
          );
        return `<article class="card mission"><div class="number">${String(i + 1).padStart(2, "0")}</div><div class="copy"><h3>${m.title}${profile.missions.includes(activeCampaign.id + ":" + m.id) ? " · Complete" : ""}</h3><p>${m.objective}</p><small class="muted">${biomes[m.biome].name} · ${m.mode} · ${m.difficulty}</small></div><button data-action="mission:${m.id}" ${unlocked ? "" : "disabled"}>${unlocked ? "Play" : "Locked"}</button></article>`;
      })
      .join(
        "",
      )}</div><div class="footer-actions"><span class="muted">Campaign progress and rewards are stored on this device.</span><span class="gold">${profile.stars} renown</span></div>`,
  );
}
function mission(id: string) {
  const m = activeCampaign.missions.find((m) => m.id === id)!;
  screen(
    m.title,
    m.objective,
    `<p class="story">${m.story}</p><p class="muted">${m.mode === "Survival" ? "Build defenses before the first wave. The enemy’s wave forces arrive at fixed intervals." : "Capture income points before committing your army. Your commander returns at the keep after defeat."}</p><div class="footer-actions">${button("Campaign map", "campaign")}${button("Enter the frontier", `launch-mission:${id}`, "primary")}</div>`,
  );
}
function expedition() {
  if (!profile.run)
    profile.run = {
      stage: 0,
      rewards: [],
      seed: "EXP-" + Date.now().toString(36),
      lives: 3,
    };
  const run = profile.run;
  void write("profile", "main", profile);
  const stage = run.stage;
  const nodes =
    stage === 4
      ? ["The Last Beacon"]
      : stage % 2 === 0
        ? ["Border battle", "Relic crossing", "Elite garrison"]
        : ["Village shelter", "Runic relic", "Supply market"];
  screen(
    "Beyond the Border",
    "A five-stage expedition. Choose your route; rewards carry into later battles.",
    `<div class="row"><span class="badge">${run.lives} lives</span><span class="badge">Seed ${escape(run.seed)}</span><span class="badge">${run.rewards.length} relics</span></div><div class="run-track">${Array.from({ length: 5 }, (_, i) => `<span class="${i < stage ? "done" : i === stage ? "current" : ""}">${i + 1}</span>`).join("")}</div><div class="run-nodes">${nodes.map((node, i) => `<article class="card"><div class="eyebrow">${stage === 4 ? "Boss" : stage % 2 === 0 ? (i === 2 ? "Elite" : "Battle") : "Encounter"}</div><h3>${node}</h3><p>${stage === 4 ? "One final battle for the ancient frontier." : stage % 2 === 0 ? (i === 0 ? "Conquer a rival keep for a veteran escort." : i === 1 ? "Control relics for ancient knowledge." : "Face Hard AI for supply wagons.") : i === 0 ? "Rest at a village. Recover one expedition life." : i === 1 ? "Gain a relic that grants Trade Roads in future battles." : "Spend 2 renown to gain extra starting resources."}</p>${button("Choose route", `node:${i}`, "primary")}</article>`).join("")}</div><p class="muted">Carried rewards: ${run.rewards.map(escape).join(", ") || "None yet"}. Battle losses consume a life; a failed run keeps your achievements and renown.</p>${button("Start a fresh expedition", "reset-run", "small")}`,
  );
}
async function chooseNode(i: number) {
  const r = profile.run!;
  if (r.stage % 2 === 1) {
    if (i === 0) r.lives = Math.min(4, r.lives + 1);
    if (i === 1) r.rewards.push("Ancient knowledge");
    if (i === 2) {
      if (profile.stars < 2) {
        toast("The market needs 2 renown. Choose another route.");
        return;
      }
      profile.stars -= 2;
      r.rewards.push("Supply wagons");
    }
    r.stage++;
    await write("profile", "main", profile);
    expedition();
    return;
  }
  runBattle = true;
  start({
    ...setup,
    seed: r.seed + "-" + r.stage + "-" + i,
    biome: Object.keys(biomes)[r.stage % 4],
    players: 2,
    teams: [0, 1],
    size: r.stage === 4 ? 42 : 28 + r.stage * 2,
    mode: i === 1 ? "Relic Hunt" : "Conquest",
    difficulty: i === 2 || r.stage === 4 ? "Hard" : "Normal",
    scale: "Quick",
    population: 65,
    bonus: r.rewards.at(-1),
  });
  if (sim) {
    for (const reward of r.rewards.slice(0, -1)) {
      if (
        reward === "Ancient knowledge" &&
        !sim.players[0].tech.includes("economy")
      )
        sim.players[0].tech.push("economy");
      if (reward === "Supply wagons") {
        sim.players[0].gold += 100;
        sim.players[0].wood += 100;
      }
    }
    (sim.settings as any).expedition = true;
    (sim.settings as any).routeReward = [
      "Veteran escort",
      "Ancient knowledge",
      "Supply wagons",
    ][i];
  }
}
function achievementMenu() {
  screen(
    "Hall of banners",
    `${Object.keys(profile.unlocked).length} / ${achievements.length} achievements unlocked`,
    `<div class="card-grid">${achievements
      .map((a) => {
        const unlocked = profile.unlocked[a.id],
          value = Math.min(a.target, profile.metrics[a.metric] ?? 0);
        return `<article class="card ${unlocked ? "unlocked" : ""}"><div class="eyebrow">${a.category}${unlocked ? " · Unlocked" : ""}</div><h3>${a.hidden && !unlocked ? "Unknown legend" : a.name}</h3><p>${a.hidden && !unlocked ? "Keep commanding the frontier to reveal this achievement." : a.description}</p><div class="progress"><i style="width:${(value / a.target) * 100}%"></i></div><small class="muted">${unlocked ? new Date(unlocked).toLocaleDateString() : `${Math.floor(value)} / ${a.target}`}</small></article>`;
      })
      .join("")}</div>`,
    true,
  );
}
function statistics() {
  const m = profile.metrics;
  screen(
    "Your command record",
    "Every completed match adds to your local history.",
    `<div class="card-grid">${[
      ["Battles", m.matches ?? 0],
      ["Victories", m.wins ?? 0],
      ["Defeats", m.losses ?? 0],
      ["Enemies defeated", m.kills ?? 0],
      ["Units recruited", m.recruited ?? 0],
      ["Buildings raised", m.buildings ?? 0],
      ["Locations captured", m.captures ?? 0],
      ["Gold collected", Math.floor(m.gold ?? 0)],
      ["Playtime", clock(m.playtime ?? 0)],
      ["Fastest victory", profile.fastest ? clock(profile.fastest) : "—"],
      ["Campaign chapters", profile.missions.length],
      ["Renown", profile.stars],
    ]
      .map(
        ([label, v]) =>
          `<div class="card"><div class="muted">${label}</div><div class="stat">${v}</div></div>`,
      )
      .join(
        "",
      )}</div><h3 style="margin-top:24px">Banners & commanders</h3><div class="row">${Object.entries(
      profile.factions,
    )
      .map(
        ([k, v]) =>
          `<span class="badge">${factions[k]?.name ?? k}: ${v}</span>`,
      )
      .join("")}${Object.entries(profile.commanders)
      .map(
        ([k, v]) =>
          `<span class="badge">${commanders[k]?.name ?? k}: ${v}</span>`,
      )
      .join("")}</div>`,
  );
}
function settingsMenu() {
  screen(
    "Settings",
    "Your settings are saved on this device.",
    `<form id="settings-form"><div class="form-grid">${input("master", "Master volume", settings.master, "range", 'min="0" max="1" step="0.05"')}${input("music", "Music volume", settings.music, "range", 'min="0" max="1" step="0.05"')}${input("effects", "Effects volume", settings.effects, "range", 'min="0" max="1" step="0.05"')}${select("quality", "Visual effects", ["High", "Low"], settings.quality)}${input("uiScale", "UI scale", settings.uiScale, "range", 'min="0.85" max="1.3" step="0.05"')}<label class="checkbox"><input type="checkbox" name="mute" ${settings.mute ? "checked" : ""}>Mute all audio</label><label class="checkbox"><input type="checkbox" name="reducedMotion" ${settings.reducedMotion ? "checked" : ""}>Reduced motion</label></div><div class="footer-actions"><span class="muted">Friendly ◆ cyan · Enemy ▲ orange<br>Team markings stay distinct without color.</span><button class="primary" type="submit">Save settings</button></div></form>`,
  );
  document
    .querySelector(".form-grid")!
    .insertAdjacentHTML(
      "afterbegin",
      `${select("theme", "World theme", themeNames, settings.theme)}${select("style", "Art style", { toon: { name: "Toon" }, realistic: { name: "Realistic illustration" }, sticker: { name: "Sticker" } }, settings.style)}<p class="theme-status" data-theme-status>${escape(themes.status)}</p>`,
    );
  document.querySelector<HTMLFormElement>("#settings-form")!.onsubmit = async (
    e,
  ) => {
    e.preventDefault();
    const f = e.currentTarget as HTMLFormElement,
      d = new FormData(f);
    settings = {
      master: Number(d.get("master")),
      music: Number(d.get("music")),
      effects: Number(d.get("effects")),
      quality: String(d.get("quality")),
      uiScale: Number(d.get("uiScale")),
      mute: d.has("mute"),
      reducedMotion: d.has("reducedMotion"),
      theme: String(d.get("theme")),
      style:
        d.get("style") === "sticker"
          ? "sticker"
          : d.get("style") === "realistic"
            ? "realistic"
            : "toon",
    };
    applySettings();
    await write("settings", "main", settings);
    const ok = await changeTheme(settings.theme, settings.style);
    toast(ok ? "Settings saved." : themes.status);
  };
  document
    .querySelector("#settings-form")!
    .insertAdjacentHTML(
      "beforeend",
      '<div class="offline-themes"><button type="button" id="download-themes">Download all worlds for offline play</button><p id="download-status" role="status">Selected themes are cached automatically. All worlds need about 120 MB.</p></div>',
    );
  document.querySelector<HTMLButtonElement>("#download-themes")!.onclick =
    async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      button.disabled = true;
      const status = document.querySelector("#download-status")!;
      try {
        await themes.downloadAll((message) => (status.textContent = message));
      } catch (error) {
        status.textContent = String(error);
      } finally {
        button.disabled = false;
      }
    };
}
function applySettings() {
  audio.settings = settings;
  audio.refreshVolumes();
  renderer.quality = settings.quality;
  renderer.reducedMotion = settings.reducedMotion;
  document.documentElement.style.setProperty(
    "--scale",
    String(settings.uiScale),
  );
}
function credits() {
  screen(
    "About the frontier",
    "Frontier Command · v1.0",
    `<p>A single-player fantasy RTS vertical slice. Command three factions across seeded maps, an authored campaign, and branching expeditions.</p><div class="card"><h3>Original assets, offline by design</h3><p>Terrain, buildings, units, icons, particles, music, and effects are created programmatically for this project. No commercial game assets are included.</p><p>Built with TypeScript, Phaser 3, Vite, IndexedDB, and Web Audio. Phaser is MIT licensed.</p></div><p class="muted" style="margin-top:20px">The game uses a fixed-step command simulation. Online multiplayer is a future extension. Local data stays in this browser.</p>${button("How to play", "help", "primary")}`,
  );
}
function help() {
  screen(
    "The commander’s field guide",
    "Claim resources, build an army, and fight alongside it.",
    `<div class="card-grid"><article class="card"><h3>Lead from the front</h3><p>WASD moves your commander. Q, E, and R activate abilities. Tap a destination to move selected units. Units automatically fight nearby enemies.</p></article><article class="card"><h3>Give orders</h3><p>Tap friendly units to select. Shift-tap adds to selection. Drag a box to select troops. Right-click orders movement or attacks. Use Army to select all troops.</p></article><article class="card"><h3>Build your foothold</h3><p>Stand near gold and wood banners for six seconds to capture them. Open Build, choose a structure, and tap open ground near your forces. Houses add population.</p></article><article class="card"><h3>Win the counter battle</h3><p>Spears counter cavalry. Cavalry punishes archers. Archers pressure infantry. Catapults excel against buildings. Dawnweavers heal your army.</p></article><article class="card"><h3>Plan under pressure</h3><p>Space pauses the battle. Issue orders and choose construction or research, then resume. Hard allows three pauses; Brutal disables pause.</p></article><article class="card"><h3>Scout and reposition</h3><p>Drag with the middle mouse or drag on touch to pan. Scroll or use ± to zoom. Tap the minimap to jump. Home or Commander follows your hero.</p></article></div><p class="muted" style="margin-top:18px">B: Build · N: Recruit · T: Research · F: Army · H: Hold · Esc: Menu · F2: Debug. On phones, use the directional pad and on-screen orders. Control groups: Ctrl+1–5 saves, 1–5 selects.</p><p class="muted">Conquest: destroy rival keeps. Domination / Relic Hunt: reach 1,000 influence. Survival: defend through 12 waves. If a battle exceeds its escalation window, territory and surviving forces decide the winner.</p>`,
  );
}
async function save(name = "manual", notify = true) {
  if (!sim || sim instanceof RushArena) return;
  try {
    await write("saves", name, {
      title:
        sim.settings.mission?.title ??
        `${sim.settings.mode} · ${sim.settings.seed}`,
      time: new Date().toISOString(),
      world: sim.serialize(),
    });
    if (notify) toast("Battle saved.");
    return true;
  } catch (e) {
    toast("Could not save: " + String(e));
    return false;
  }
}
async function savesMenu() {
  const entries = await list<{ title: string; time: string; world: string }>(
    "saves",
  );
  entries.sort(
    (a, b) =>
      (Date.parse(b.value.time) || 0) - (Date.parse(a.value.time) || 0) ||
      Number(b.key === "manual") - Number(a.key === "manual"),
  );
  screen(
    "Continue your command",
    "Newest saves appear first. Saves are preserved across application updates.",
    entries.length
      ? `<div class="missions">${entries.map((e) => `<div class="card mission"><div class="copy"><h3>${escape(e.value.title)}</h3><p>${e.key === "autosave" ? "Autosave" : "Manual save"} · ${new Date(e.value.time).toLocaleString()}</p></div>${button("Resume", `load:${e.key}`)}${button("Delete", `delete:${e.key}`, "small")}</div>`).join("")}</div>`
      : '<p class="muted">No saved battles yet. Start a skirmish or campaign.</p>' +
          button("New skirmish", "skirmish", "primary"),
  );
}
async function load(name: string) {
  try {
    const d = await read<{ world: string }>("saves", name);
    if (!d) throw Error("Save not found");
    sim = Simulation.restore(d.world);
    ended = false;
    selection = sim.entities
      .filter((e) => e.team === 0 && commanders[e.kind])
      .map((e) => e.id);
    renderer.selected = selection;
    renderer.world = sim;
    renderer.follow = true;
    accumulator = 0;
    runBattle = !!(sim.settings as any).expedition;
    setView("game");
    audio.start();
    toast("Command restored.");
  } catch (e) {
    toast(String(e));
  }
}
function gameUI() {
  if (!sim) return;
  const p = sim.players[0],
    hero = sim.entities.find((e) => e.team === 0 && commanders[e.kind]);
  ui.innerHTML = `<div class="hud-top"><div class="resource-bar"><div class="resource gold" id="gold">0<span>Gold</span></div><div class="resource wood" id="wood">0<span>Wood</span></div><div class="resource" id="population">0<span>Population</span></div><div class="resource" id="time">0:00<span>${sim.settings.scale}</span></div></div><div class="hud-actions">${button("Pause", "pause", "small")}${button("Menu", "match-menu", "small")}</div></div><div class="hud-objective"><strong id="mode-title">${sim.settings.mode} · ${factions[p.faction].mark} ${factions[p.faction].name}</strong><p id="objective"></p><p id="score" style="color:var(--gold);margin-top:6px"></p></div><div class="minimap-wrap"><canvas id="minimap" width="150" height="150" aria-label="Battlefield minimap"></canvas><div class="minimap-caption"><span>${escape(sim.settings.seed)}</span><span>◆ / ▲</span></div></div><div class="selection" id="selection">Commander selected</div><div class="hint" id="hint">WASD move · Q / E / R abilities · Right-click orders · Space tactical pause</div><div class="side-actions">${button("Build <kbd>B</kbd>", "panel:build")}${button("Recruit <kbd>N</kbd>", "panel:recruit")}${button("Research <kbd>T</kbd>", "panel:research")}</div><div class="bottom-hud"><div class="commander-card"><strong>${commanders[p.commander].name}</strong><div class="bar"><i id="hero-bar" style="width:100%"></i></div><small class="muted" id="hero-health">${hero?.hp} health</small></div><div class="ability-row">${commanders[p.commander].abilities.map((a, i) => `<button class="ability" data-action="ability:${i}" id="ability-${i}"><b>${["Q", "E", "R"][i]}</b>${a}</button>`).join("")}</div><div class="orders">${button("Commander", "commander")}${button("Army", "army")}${button("Attack-move", "attackmove")}${button("Hold", "hold")}${button("− / +", "zoom")}</div></div><div class="mobile-pad"><button data-dir="up" aria-label="Move up">▲</button><button data-dir="left" aria-label="Move left">◀</button><span class="center">◆</span><button data-dir="right" aria-label="Move right">▶</button><button data-dir="down" aria-label="Move down">▼</button></div><div id="panel-root"></div><div id="pause-root"></div>`;
  document.querySelector<HTMLCanvasElement>("#minimap")!.onclick = (e) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    renderer.center({
      x: ((e.clientX - rect.left) / rect.width) * sim!.map.settings.size,
      y: ((e.clientY - rect.top) / rect.height) * sim!.map.settings.size,
    });
    renderer.follow = false;
  };
  document.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((b) => {
    const dir = b.dataset.dir!,
      key = { up: "w", left: "a", right: "d", down: "s" }[dir]!;
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      keys.add(key);
    };
    b.onpointerup = () => keys.delete(key);
    b.onpointercancel = () => keys.delete(key);
  });
  if (sim instanceof RushArena) {
    document.querySelector(".side-actions")?.remove();
    document.querySelector(".minimap-wrap")?.remove();
    document.querySelector("#hint")!.textContent =
      "Move your commander · Escort follows · Collect caches · Avoid red strikes";
    document.querySelector(".hud-objective")?.classList.add("arena-objective");
  }
  updateHUD();
  const controls = document.createElement("div");
  controls.className = "theme-controls";
  controls.innerHTML = `${select("battleTheme", "World", themeNames, settings.theme)}${select("battleStyle", "Style", { toon: { name: "Toon" }, realistic: { name: "Realistic" }, sticker: { name: "Sticker" } }, settings.style)}<span data-theme-status>${escape(themes.status)}</span>`;
  ui.append(controls);
  controls.onchange = async () => {
    const id = controls.querySelector<HTMLSelectElement>(
      '[name="battleTheme"]',
    )!.value;
    const style = controls.querySelector<HTMLSelectElement>(
      '[name="battleStyle"]',
    )!.value as ThemeStyle;
    if (!(await changeTheme(id, style))) toast(themes.status);
  };
  decorateCommands();
}
function updateHUD() {
  if (!sim || view !== "game") return;
  const p = sim.players[0],
    hero = sim.entities.find((e) => e.team === 0 && commanders[e.kind]);
  const update = (id: string, html: string) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  update("gold", `${Math.floor(p.gold)}<span>Gold</span>`);
  update("wood", `${Math.floor(p.wood)}<span>Wood</span>`);
  update(
    "population",
    `${sim.population(0)} / ${sim.capacity(0)}<span>Population</span>`,
  );
  update(
    "time",
    `${clock(sim.time)}<span>${daylight(sim.time).phase} · ${sim.settings.scale}</span>`,
  );
  update("objective", escape(sim.objective));
  update(
    "score",
    sim.settings.mode === "Survival"
      ? `Wave ${sim.wave} / 12`
      : ["Domination", "Relic Hunt"].includes(sim.settings.mode)
        ? sim.players
            .map((p, i) => `${i === 0 ? "◆" : "▲"} ${Math.floor(p.score)}`)
            .join(" · ") + " / 1,000"
        : sim.time > scales[sim.settings.scale].minutes * 30
          ? "The frontier escalates. Territory will decide a prolonged battle."
          : "",
  );
  if (hero) {
    const name = document.querySelector(".commander-card strong");
    if (name)
      name.textContent = themes.name(hero.kind)
        ? themes.name(hero.kind) + " · " + commanders[hero.kind].name
        : commanders[hero.kind].name;
    const bar = document.querySelector<HTMLElement>("#hero-bar");
    if (bar) bar.style.width = Math.max(0, (hero.hp / hero.maxHp) * 100) + "%";
    update(
      "hero-health",
      hero.hp > 0
        ? `${Math.ceil(hero.hp)} / ${Math.ceil(hero.maxHp)} HP`
        : `Returns in ${Math.ceil(hero.respawn ?? 0)}s`,
    );
    commanders[hero.kind].abilities.forEach((a, i) => {
      const b = document.querySelector<HTMLButtonElement>(`#ability-${i}`);
      if (b) {
        b.innerHTML = `<b>${hero.abilities[i] > 0 ? Math.ceil(hero.abilities[i]) + "s" : ["Q", "E", "R"][i]}</b>${a}`;
        b.disabled = hero.hp <= 0 || hero.abilities[i] > 0;
      }
    });
  }
  const selected = sim.entities.filter(
    (e) => selection.includes(e.id) && e.hp > 0,
  );
  update(
    "selection",
    selected.length
      ? selected.length === 1
        ? `${themes.name(selected[0].kind, selected[0].building) ? themes.name(selected[0].kind, selected[0].building) + " · " : ""}${selected[0].building ? buildings[selected[0].kind].name : (units[selected[0].kind]?.name ?? commanders[selected[0].kind]?.name)} · ${Math.ceil(selected[0].hp)} HP${selected[0].queue.length ? " · Training: " + selected[0].queue.map((q) => units[q.kind].name + " " + Math.ceil(q.remaining) + "s").join(", ") : ""}`
        : `${selected.length} units selected · ${mode === "AttackMove" ? "Attack-move" : "Move"} orders`
      : "No units selected. Tap a unit or choose Army.",
  );
  if (!(sim instanceof RushArena && sim.pendingUpgrade))
    update(
      "pause-root",
      sim.paused && !(sim instanceof RushArena && sim.pendingUpgrade)
        ? `<div class="paused-label"><strong>Tactical pause</strong><p>${sim.commands.length} queued orders · inspect, plan, then resume</p></div>`
        : "",
    );
  if (sim instanceof RushArena) {
    update("gold", `${sim.collected[0]}<span>Supplies</span>`);
    update("wood", `${sim.stats.kills}<span>Defeated</span>`);
    update(
      "population",
      `${sim.entities.filter((e) => e.team === 0 && e.hp > 0).length}<span>Squad</span>`,
    );
    update(
      "time",
      `${clock(Math.max(0, sim.duration - sim.time))}<span>Remaining</span>`,
    );
    update("score", "Green: heal · Gold: escort · Violet: energy");
    if (sim.pendingUpgrade && !document.querySelector(".arena-upgrade"))
      update(
        "pause-root",
        `<div class="arena-upgrade" role="dialog" aria-modal="true" aria-label="Choose arena upgrade"><h2>Power drop</h2><p>Choose an upgrade to resume the arena.</p><div class="arena-upgrade-options">${Object.entries(
          arenaUpgrades,
        )
          .map(
            ([id, u]) =>
              `<button data-action="arena-upgrade:${id}"><strong>${u.name}</strong><span>${u.description}</span></button>`,
          )
          .join("")}</div></div>`,
      );
  }
  const minimap = document.querySelector<HTMLCanvasElement>("#minimap");
  if (minimap) renderer.minimap(minimap);
  if (panel === "debug") updateDebug();
  decorateCommands();
}
function showPanel(kind: string) {
  if (sim instanceof RushArena && kind !== "debug") {
    toast("Arena upgrades replace base construction.");
    return;
  }
  if (panel === kind) {
    panel = "";
    document.querySelector("#panel-root")!.innerHTML = "";
    return;
  }
  panel = kind;
  const root = document.querySelector("#panel-root")!;
  let body = "";
  if (kind === "build")
    body = `<p class="muted">Choose a structure, then tap open ground near your army.</p><div class="catalog">${Object.entries(
      buildings,
    )
      .filter(([k]) => k !== "keep")
      .map(
        ([k, d]) =>
          `<button data-action="build:${k}"><strong>${d.name}</strong><span>${d.gold} gold · ${d.wood} wood</span><small>${d.description}${d.requires ? " Requires " + buildings[d.requires].name + "." : ""}</small></button>`,
      )
      .join("")}</div>`;
  if (kind === "recruit")
    body = `<p class="muted">Requires a completed production building. Queues support five units.</p><div class="catalog">${Object.entries(
      units,
    )
      .map(
        ([k, d]) =>
          `<button data-action="recruit:${k}"><strong>${d.name}</strong><span>${Math.ceil(d.gold * factions[sim!.players[0].faction].cost)} gold · ${Math.ceil(d.wood * factions[sim!.players[0].faction].cost)} wood</span><small>${buildings[d.building].name} · ${d.pop} population · ${d.time}s</small></button>`,
      )
      .join("")}</div>`;
  if (kind === "research")
    body = `<p class="muted">Research resets each battle. Prerequisites form each branch.</p><div class="catalog">${Object.entries(
      technologies,
    )
      .map(
        ([k, d]) =>
          `<button data-action="research:${k}" ${sim!.players[0].tech.includes(k) ? "disabled" : ""}><small>${d.branch}</small><strong>${d.name}${sim!.players[0].tech.includes(k) ? " ✓" : ""}</strong><span>${d.gold} gold · ${d.wood} wood</span><small>${d.description} Requires ${buildings[d.requires].name}.</small></button>`,
      )
      .join("")}</div>`;
  if (kind === "debug")
    body = `<div class="row">${button("Reveal map", "debug:reveal", "small")}${button("+1000 resources", "debug:resources", "small")}${button("Spawn troop", "debug:spawn", "small")}${button("Kill selected", "debug:kill", "small")}${button("Cycle speed", "debug:speed", "small")}${button("Change team", "debug:team", "small")}</div><pre class="debug" id="debug-state"></pre>`;
  root.innerHTML = `<section class="panel"><div class="panel-header"><h3>${kind === "build" ? "Raise your settlement" : kind === "recruit" ? "Muster the army" : kind === "research" ? "Knowledge of war" : "Development tools"}</h3>${button("×", "close-panel", "small")}</div>${body}</section>`;
}
function updateDebug() {
  const el = document.querySelector("#debug-state");
  if (!el || !sim) return;
  el.textContent =
    `Seed: ${sim.settings.seed}\nTick: ${sim.tick} · FPS: ${Math.round(renderer.fps)}\nEntities: ${sim.entities.filter((e) => e.hp > 0).length}\nSpeed: ${sim.settings.speed}x\n` +
    sim.players
      .map(
        (p, i) =>
          `Player ${i}: ${p.plan}\n${Math.floor(p.gold)}g ${Math.floor(p.wood)}w · ${sim!.population(i)} units`,
      )
      .join("\n") +
    "\nSelected:\n" +
    JSON.stringify(
      sim.entities
        .filter((e) => selection.includes(e.id))
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          hp: e.hp,
          order: e.order,
          path: e.route.length,
          target: e.target,
        })),
      null,
      2,
    );
}
function issue(order: Omit<Order, "team">) {
  if (!sim) return;
  sim.issue({ ...order, team: 0 });
  audio.effect("move");
  if (sim.paused) updateHUD();
}
function selectIds(ids: number[]) {
  selection = ids;
  renderer.selected = ids;
  audio.effect("select");
  updateHUD();
}
function matchMenu() {
  if (!sim) return;
  if (sim instanceof RushArena) {
    view = "match-menu";
    screen(
      "Arena intermission",
      `${clock(sim.time)} elapsed · ${sim.collected[0]} supplies collected`,
      `<div class="menu-actions">${button("Return to arena", "resume", "primary")}${button("Retry arena", "arena-retry")}${button("World settings", "settings")}${button(suspendedBattle ? "Return to RTS battle" : "Main menu", "arena-return")}</div><p class="muted">The arena stops while this menu is open. Your RTS save remains untouched.</p>`,
    );
    return;
  }
  view = "match-menu";
  screen(
    "Council of war",
    `${sim.settings.mode} · ${clock(sim.time)} · ${sim.settings.seed}`,
    `<div class="menu-actions">${button("Return to battle", "resume", "primary")}${button("Save battle", "save")}${button("Load a save", "continue")}${button("Field guide", "help")}${button("Settings", "settings")}${button("Rush Arena", "arena")}${button("Main menu", "leave")}${button("Debug tools", "debug-from-menu")}</div><p class="muted" style="margin-top:18px">The battle stops while this menu is open. Your latest battle is autosaved before returning to the main menu.</p>`,
  );
}
async function finish() {
  if (!sim || ended) return;
  ended = true;
  if (sim instanceof RushArena) {
    const arena = sim;
    const won = arena.winner === 0;
    audio.state = won ? "victory" : "defeat";
    audio.effect(won ? "victory" : "defeat");
    view = "result";
    screen(
      won ? "Arena champion!" : "Your squad has fallen",
      won
        ? "Your commander outlasted the rival squads."
        : "Try a different route, commander, or upgrade.",
      `<div class="card-grid"><article class="card"><h3>${clock(arena.time)}</h3><p>Survival time</p></article><article class="card"><h3>${arena.stats.kills}</h3><p>Enemies defeated</p></article><article class="card"><h3>${arena.collected[0]}</h3><p>Supplies collected</p></article><article class="card"><h3>${arena.upgrades}</h3><p>Upgrades chosen</p></article></div><div class="footer-actions">${button("Retry arena", "arena-retry", "primary")}${button("New arena", "arena")}${button(suspendedBattle ? "Return to RTS battle" : "Main menu", "arena-return")}</div>`,
    );
    return;
  }
  const won = sim.winner !== null && sim.friendly(sim.winner, 0),
    s = sim;
  const unlocked = recordMatch(profile, s);
  if (runBattle && profile.run) {
    if (won) {
      profile.run.rewards.push(
        (s.settings as any).routeReward ?? "Veteran escort",
      );
      profile.run.stage++;
      if (profile.run.stage >= 5) {
        profile.metrics.expedition = (profile.metrics.expedition ?? 0) + 1;
        profile.run = null;
        const a = achievements.find((a) => a.id === "rogue")!;
        profile.unlocked[a.id] = new Date().toISOString();
        unlocked.push(a.name);
      }
    } else {
      profile.run.lives--;
      if (profile.run.lives <= 0) profile.run = null;
    }
  }
  runBattle = false;
  await write("profile", "main", profile);
  await remove("saves", "autosave");
  audio.state = won ? "victory" : "defeat";
  audio.effect("end");
  view = "result";
  screen(
    won ? "The frontier is yours" : "Your banner has fallen",
    won
      ? "A victory earned through steel and strategy."
      : "The frontier remembers. Return with a new plan.",
    `<div class="card-grid">${[
      ["Battle duration", clock(s.time)],
      ["Enemies defeated", s.stats.kills],
      ["Units recruited", s.stats.recruited],
      ["Locations captured", s.stats.captures],
      ["Structures completed", s.stats.buildings],
      ["Gold gathered", Math.floor(s.stats.gold)],
    ]
      .map(
        ([k, v]) =>
          `<article class="card"><div class="muted">${k}</div><div class="stat">${v}</div></article>`,
      )
      .join(
        "",
      )}</div>${unlocked.length ? `<p class="gold" style="margin-top:18px">Achievements unlocked: ${unlocked.join(" · ")}</p>` : ""}<div class="footer-actions">${button("Main menu", "menu")}${button(s.settings.mission ? "Campaign map" : (s.settings as any).expedition ? "Expedition map" : "Play again", s.settings.mission ? "campaign" : (s.settings as any).expedition ? "expedition" : "replay", "primary")}</div>`,
  );
}
const groups: Record<string, number[]> = {};
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  const k = e.key.toLowerCase();
  if (view !== "game") return;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === " ") {
    sim?.setPause();
    updateHUD();
  }
  if (k === "escape") {
    if (buildKind) {
      buildKind = "";
      renderer.placement = undefined;
      toast("Placement cancelled.");
    } else matchMenu();
  }
  if (k === "q" || k === "e" || k === "r")
    issue({ type: "UseAbility", slot: ["q", "e", "r"].indexOf(k) });
  if (k === "b" || k === "n" || k === "t")
    showPanel({ b: "build", n: "recruit", t: "research" }[k]!);
  if (k === "f")
    selectIds(
      sim!.entities
        .filter((e) => e.team === 0 && !e.building && e.hp > 0)
        .map((e) => e.id),
    );
  if (k === "h") issue({ type: "Hold", ids: selection });
  if (k === "home") {
    renderer.follow = true;
    selectIds(
      sim!.entities
        .filter((e) => e.team === 0 && commanders[e.kind])
        .map((e) => e.id),
    );
  }
  if (k === "f2") {
    e.preventDefault();
    showPanel("debug");
  }
  if (["1", "2", "3", "4", "5"].includes(k)) {
    if (e.ctrlKey) {
      e.preventDefault();
      groups[k] = [...selection];
      toast("Group " + k + " assigned.");
    } else if (groups[k]) selectIds(groups[k]);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  if (view === "game") void save("autosave", false);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && view === "game") void save("autosave", false);
});
renderer.onTap = (p, button, shift) => {
  if (view === "editor") {
    paint(p);
    return;
  }
  if (view !== "game" || !sim) return;
  if (buildKind) {
    issue({ type: "Build", kind: buildKind, x: p.x, y: p.y });
    if (!shift) {
      buildKind = "";
      renderer.placement = undefined;
    }
    return;
  }
  const hit = sim.entities
    .filter(
      (e) =>
        e.hp > 0 &&
        (e.team === 0 ||
          renderer.reveal ||
          sim!.visible[0][index(sim!.map, e.x, e.y)]) &&
        dist(e, p) < (e.building ? 1.3 : 1),
    )
    .sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (button === 0 && hit?.team === 0) {
    selectIds(shift ? [...new Set([...selection, hit.id])] : [hit.id]);
    return;
  }
  if (hit && hit.team !== 0) {
    issue({ type: "Attack", ids: selection, target: hit.id });
    return;
  }
  const selectedBuildings = sim.entities.filter(
    (e) => selection.includes(e.id) && e.building,
  );
  const resource = sim.map.points.find(
    (point) =>
      (point.kind === "gold" || point.kind === "wood") &&
      dist(point, p) < 1.35 &&
      sim!.explored[0][index(sim!.map, point.x, point.y)],
  );
  if (resource && !selectedBuildings.length) {
    const label = resource.kind === "gold" ? "Gold mine" : "Timber grove";
    toast(
      resource.remaining === 0
        ? `${label} depleted. Scout for another site.`
        : `${label}: ${Math.ceil(resource.remaining ?? 0)} remaining. ${resource.owner === 0 ? "Your workers harvest automatically." : "Stand here uncontested to capture it."}`,
    );
    if (resource.remaining !== 0)
      issue({ type: "Capture", ids: selection, x: resource.x, y: resource.y });
    return;
  }
  issue({
    type: selectedBuildings.length ? "Rally" : (mode as "Move" | "AttackMove"),
    ids: selection,
    x: p.x,
    y: p.y,
  });
  renderer.events([{ type: "move", x: p.x, y: p.y }]);
};
renderer.onBox = (a, b) => {
  if (view !== "game" || !sim) return;
  selectIds(
    sim.entities
      .filter(
        (e) =>
          e.team === 0 &&
          !e.building &&
          e.hp > 0 &&
          e.x >= Math.min(a.x, b.x) &&
          e.x <= Math.max(a.x, b.x) &&
          e.y >= Math.min(a.y, b.y) &&
          e.y <= Math.max(a.y, b.y),
      )
      .map((e) => e.id),
  );
};
renderer.onFrame = (dt) => {
  if (view !== "game" || !sim || document.hidden) return;
  hudTime += dt;
  saveTime += dt;
  inputTime += dt;
  if (inputTime > 0.14) {
    inputTime = 0;
    const e = sim.entities.find(
      (e) => e.team === 0 && commanders[e.kind] && e.hp > 0,
    );
    let dx = 0,
      dy = 0;
    if (keys.has("w") || keys.has("arrowup")) {
      dx--;
      dy--;
    }
    if (keys.has("s") || keys.has("arrowdown")) {
      dx++;
      dy++;
    }
    if (keys.has("a") || keys.has("arrowleft")) {
      dx--;
      dy++;
    }
    if (keys.has("d") || keys.has("arrowright")) {
      dx++;
      dy--;
    }
    if (e && (dx || dy)) {
      sim.issue({ type: "Move", team: 0, ids: [e.id], dx, dy });
      renderer.follow = !(sim instanceof RushArena);
    }
  }
  if (sim.paused) accumulator = 0;
  else accumulator += dt * sim.settings.speed;
  let steps = 0;
  while (
    accumulator >= 0.1 &&
    steps < 12 &&
    !sim.paused &&
    sim.winner === null
  ) {
    sim.step(0.1);
    accumulator -= 0.1;
    steps++;
    renderer.events(sim.events);
    for (const e of sim.events) {
      if (
        ["notice", "dialogue", "depleted"].includes(e.type) &&
        e.text &&
        (e.team === undefined || e.team === 0)
      )
        toast(e.text);
      if (e.team === 0 && ["capture", "research"].includes(e.type))
        toast(e.text ?? "Territory captured. Income increased.");
      if (
        e.x === undefined ||
        e.y === undefined ||
        renderer.reveal ||
        sim.visible[0][index(sim.map, e.x, e.y)]
      )
        audio.effect(
          e.type === "ability"
            ? (e.text?.toLowerCase().replace(/ /g, "-") ?? "ability")
            : e.type === "death" && buildings[e.targetKind ?? ""]
              ? "building-collapse"
              : (e.sound ?? e.type),
          e.x !== undefined && e.y !== undefined
            ? { x: e.x, y: e.y, listener: renderer.camera }
            : undefined,
        );
      if (
        e.type === "hit" &&
        e.sound === "arrow" &&
        (renderer.reveal || sim.visible[0][index(sim.map, e.x!, e.y!)])
      )
        audio.effect("hit");
    }
  }
  const enemies = sim.entities.some(
    (e) =>
      e.team !== 0 &&
      e.hp > 0 &&
      e.cooldown > 0 &&
      sim!.visible[0][index(sim!.map, e.x, e.y)],
  );
  audio.state =
    sim instanceof RushArena || enemies
      ? "combat"
      : sim.time > 300
        ? "tension"
        : "peace";
  if (hudTime > 0.25) {
    hudTime = 0;
    updateHUD();
  }
  if (saveTime > 30) {
    saveTime = 0;
    void save("autosave", false);
  }
  if (sim.winner !== null) void finish();
};
function editorUI() {
  if (!editor) return;
  renderer.editor = editor;
  ui.innerHTML = `<div class="editor-top"><div class="row"><span class="crest">◆</span><strong>Frontier cartographer</strong></div><div class="row">${button("Save", "editor-save")}${button("Load", "editor-load")}${button("Clone", "editor-clone")}${button("Export", "editor-export")}${button("Import", "editor-import")}${button("Play map", "editor-play", "primary")}${button("Menu", "menu")}</div></div><div class="editor-panel">${input("editorName", "Map name", editorName)}${select("editorSize", "New map dimensions", ["24", "28", "32", "36", "48", "56"], String(editor.settings.size))}${select("editorBiome", "Biome", biomes, editor.settings.biome)}${select("editorVictory", "Victory", ["Conquest", "Domination", "Relic Hunt", "Survival"], editorVictory)}${select("editorTeam", "Owner / player", ["0", "1", "2", "3"], String(editorTeam))}${select("brush", "Paint / place", { "0": { name: "Grass / open" }, "1": { name: "Forest" }, "2": { name: "Slow marsh" }, "3": { name: "Water (blocked)" }, "4": { name: "Rock (blocked)" }, erase: { name: "Erase object" }, spawn: { name: "Player spawn" }, gold: { name: "Gold resource" }, wood: { name: "Wood resource" }, relic: { name: "Relic objective" }, camp: { name: "Neutral camp" }, ...Object.fromEntries(Object.entries(buildings).map(([k, v]) => ["b:" + k, { name: v.name }])), ...Object.fromEntries(Object.entries(units).map(([k, v]) => ["u:" + k, { name: v.name }])) }, brush)}${button("Generate new terrain", "editor-generate")}${button("Validate map", "editor-validate")}${button("Zoom out", "editor-zoomout")}${button("Zoom in", "editor-zoomin")}</div><div class="editor-help"><p>Tap to paint or place. Drag to pan on touch; middle-drag on desktop. Exported JSON can be shared and imported offline.</p><div id="validation" class="validation"></div></div><input type="file" id="map-import" accept="application/json,.json" hidden>`;
  document
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >(".editor-panel input,.editor-panel select")
    .forEach(
      (el) =>
        (el.onchange = () => {
          if (el.name === "brush") brush = el.value;
          if (el.name === "editorName") editorName = el.value;
          if (el.name === "editorTeam") editorTeam = Number(el.value);
          if (el.name === "editorSize") editorSize = Number(el.value);
          if (el.name === "editorBiome") {
            editorBiome = el.value;
            editor!.settings.biome = el.value;
          }
          if (el.name === "editorVictory") {
            editorVictory = el.value;
            editor!.victory = el.value;
          }
        }),
    );
  document.querySelector<HTMLInputElement>("#map-import")!.onchange = async (
    e,
  ) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const m = JSON.parse(await file.text()) as MapData;
      const errors = validateMap(m);
      if (errors.length) throw Error(errors.join("; "));
      if (
        m.placements?.some(
          (p) => !(p.building ? buildings[p.kind] : units[p.kind]),
        )
      )
        throw Error("Unknown entity in map");
      editor = m;
      editorVictory = m.victory ?? "Conquest";
      editorUI();
      toast("Map imported.");
    } catch (err) {
      toast("Import failed: " + String(err));
    }
  };
}
function paint(p: Point) {
  if (!editor) return;
  const x = Math.floor(p.x),
    y = Math.floor(p.y),
    n = editor.settings.size;
  if (x < 0 || y < 0 || x >= n || y >= n) return;
  if (["0", "1", "2", "3", "4"].includes(brush)) {
    editor.tiles[y * n + x] = Number(brush);
    return;
  }
  if (brush === "erase") {
    editor.points = editor.points.filter(
      (q) => Math.floor(q.x) !== x || Math.floor(q.y) !== y,
    );
    editor.placements = editor.placements?.filter(
      (q) => q.x !== x || q.y !== y,
    );
    return;
  }
  if (brush === "spawn") {
    editor.spawns[editorTeam] = { x, y };
    editor.spawns = editor.spawns.filter(Boolean);
    editor.settings.players = editor.spawns.length;
    return;
  }
  if (["gold", "wood", "relic", "camp"].includes(brush)) {
    editor.points = editor.points.filter((q) => q.x !== x || q.y !== y);
    editor.points.push({ x, y, kind: brush as "gold", owner: -1, progress: 0 });
    return;
  }
  if (brush.startsWith("b:") || brush.startsWith("u:")) {
    editor.placements ??= [];
    editor.placements.push({
      x,
      y,
      kind: brush.slice(2),
      team: editorTeam,
      building: brush.startsWith("b:"),
    });
  }
}
async function editorAction(action: string) {
  if (!editor) return;
  const validate = () => {
    const errors = validateMap(editor!);
    document.querySelector("#validation")!.textContent = errors.length
      ? errors.slice(0, 6).join("\n")
      : "✓ All spawns, resources, and objectives are reachable.";
    return errors;
  };
  if (action === "editor-validate") validate();
  if (action === "editor-save") {
    if (validate().length) return;
    await write("maps", editorName, { name: editorName, map: editor });
    toast("Map saved.");
  }
  if (action === "editor-load") {
    const entries = await list<{ name: string; map: MapData }>("maps");
    view = "editor-load";
    screen(
      "Your frontiers",
      "Locally saved editor maps.",
      entries.length
        ? `<div class="missions">${entries.map((e) => `<div class="card mission"><div class="copy"><h3>${escape(e.value.name)}</h3><p>${e.value.map.settings.size} × ${e.value.map.settings.size} · ${biomes[e.value.map.settings.biome].name}</p></div><button data-map-key="${escape(e.key)}">Open map</button></div>`).join("")}</div>`
        : "<p>No saved maps yet.</p>",
    );
  }
  if (action === "editor-clone") {
    editor = structuredClone(editor);
    editorName += " copy";
    editorUI();
    toast("Clone ready. Save it to keep both maps.");
  }
  if (action === "editor-export") {
    const blob = new Blob([JSON.stringify(editor, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "frontier-map.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (action === "editor-import")
    document.querySelector<HTMLInputElement>("#map-import")!.click();
  if (action === "editor-generate") {
    editor = generateMap({
      ...defaults,
      size: editorSize,
      biome: editorBiome,
      seed: "EDITOR-" + Date.now(),
    });
    editor.placements = [];
    renderer.center({ x: editorSize / 2, y: editorSize / 2 });
    editorUI();
  }
  if (action === "editor-play") {
    if (validate().length) return;
    start(
      {
        ...setup,
        ...editor.settings,
        mode: editorVictory,
        teams: editor.spawns.map((_, i) => i),
      },
      editor,
    );
  }
  if (action === "editor-zoomout")
    renderer.zoom = Math.max(0.4, renderer.zoom - 0.15);
  if (action === "editor-zoomin")
    renderer.zoom = Math.min(1.8, renderer.zoom + 0.15);
}
ui.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-action],[data-map-key]",
  );
  if (!el) return;
  audio.start();
  audio.effect(
    ["back", "menu", "resume"].includes(el.dataset.action ?? "")
      ? "back"
      : "ui",
  );
  if (el.dataset.mapKey) {
    const d = await read<{ map: MapData; name: string }>(
      "maps",
      el.dataset.mapKey,
    );
    if (d) {
      editor = d.map;
      editorVictory = editor.victory ?? "Conquest";
      editorName = d.name;
      setView("editor");
    }
    return;
  }
  const action = el.dataset.action!;
  const [verb, id] = action.split(":");
  if (action === "arena") {
    if (sim && !(sim instanceof RushArena) && !ended) {
      suspendedBattle = sim;
      suspendedRunBattle = runBattle;
    }
    arenaMenu();
    return;
  }
  if (action === "arena-start") {
    startArena(
      (document.querySelector('[name="arenaSeed"]') as HTMLInputElement)
        .value || "RUSH",
      (document.querySelector('[name="arenaCommander"]') as HTMLSelectElement)
        .value,
    );
    return;
  }
  if (action === "arena-retry" && sim instanceof RushArena) {
    startArena(sim.settings.seed, sim.settings.commander);
    return;
  }
  if (action === "arena-return") {
    returnFromArena();
    return;
  }
  if (verb === "arena-upgrade" && sim instanceof RushArena) {
    sim.chooseUpgrade(id as ArenaUpgrade);
    audio.effect("ui-confirm");
    updateHUD();
    return;
  }
  if (
    [
      "menu",
      "skirmish",
      "campaign",
      "expedition",
      "achievements",
      "stats",
      "settings",
      "credits",
      "continue",
      "editor",
    ].includes(action)
  ) {
    setView(action);
    return;
  }
  if (action === "back") {
    if (
      sim &&
      !ended &&
      (view === "settings" || view === "continue" || view === "help")
    ) {
      setView("game");
      return;
    }
    setView("menu");
  }
  if (action === "help") {
    view = "help";
    help();
  }
  if (verb === "campaign-select") {
    activeCampaign = campaigns.find((c) => c.id === id)!;
    campaignMenu();
  }
  if (verb === "mission") mission(id);
  if (verb === "launch-mission") {
    const m = activeCampaign.missions.find((m) => m.id === id)!;
    runBattle = false;
    start(
      {
        ...setup,
        faction: activeCampaign.faction,
        commander: activeCampaign.commander,
        seed: m.seed ?? activeCampaign.id + "-" + id,
        players: 2,
        teams: [0, 1],
        biome: m.biome,
        size: m.size,
        difficulty: m.difficulty,
        mode: m.mode,
        scale: "Standard",
        mission: m,
        campaignId: activeCampaign.id,
        starting: m.modifiers?.gold ?? 350,
        ...m.map?.settings,
      },
      m.map,
    );
  }
  if (verb === "node") await chooseNode(Number(id));
  if (action === "reset-run") {
    profile.run = null;
    expedition();
  }
  if (verb === "load") await load(id);
  if (verb === "delete") {
    await remove("saves", id);
    await savesMenu();
  }
  if (action === "copy-seed") {
    const value = (document.querySelector("[name=seed]") as HTMLInputElement)
      .value;
    try {
      await navigator.clipboard.writeText(value);
      toast("Seed copied: " + value);
    } catch {
      toast("Seed: " + value);
    }
  }
  if (action === "pause") {
    sim?.setPause();
    updateHUD();
  }
  if (action === "match-menu") matchMenu();
  if (action === "resume") setView("game");
  if (action === "save") await save();
  if (action === "leave") {
    await save("autosave", false);
    setView("menu");
  }
  if (action === "replay" && sim) start(sim.settings);
  if (verb === "panel") showPanel(id);
  if (action === "close-panel") {
    panel = "";
    document.querySelector("#panel-root")!.innerHTML = "";
  }
  if (verb === "build") {
    buildKind = id;
    renderer.placement = id;
    panel = "";
    document.querySelector("#panel-root")!.innerHTML = "";
    toast(`Place ${buildings[id].name} on open ground. Esc cancels.`);
  }
  if (verb === "recruit") issue({ type: "Recruit", kind: id, ids: selection });
  if (verb === "research") {
    issue({ type: "Research", kind: id });
    if (!sim?.paused)
      setTimeout(() => {
        panel = "";
        showPanel("research");
      }, 150);
  }
  if (verb === "ability") issue({ type: "UseAbility", slot: Number(id) });
  if (action === "commander" && sim) {
    selectIds(
      sim.entities
        .filter((e) => e.team === 0 && commanders[e.kind])
        .map((e) => e.id),
    );
    renderer.follow = true;
  }
  if (action === "army" && sim)
    selectIds(
      sim.entities
        .filter((e) => e.team === 0 && !e.building && e.hp > 0)
        .map((e) => e.id),
    );
  if (action === "attackmove") {
    mode = mode === "AttackMove" ? "Move" : "AttackMove";
    toast(
      mode === "AttackMove"
        ? "Attack-move: tap a destination."
        : "Move orders selected.",
    );
    updateHUD();
  }
  if (action === "hold") issue({ type: "Hold", ids: selection });
  if (action === "zoom") renderer.zoom = renderer.zoom > 0.9 ? 0.65 : 1.2;
  if (action === "debug-from-menu") {
    setView("game");
    showPanel("debug");
  }
  if (verb === "debug" && sim) {
    if (id === "reveal") renderer.reveal = !renderer.reveal;
    if (id === "resources") {
      sim.players[0].gold += 1000;
      sim.players[0].wood += 1000;
    }
    if (id === "spawn") {
      const p = sim.map.spawns[0];
      sim.spawn("swordsman", 0, p.x + 2, p.y + 2);
    }
    if (id === "kill")
      sim.entities
        .filter((e) => selection.includes(e.id))
        .forEach((e) => (e.hp = 0));
    if (id === "speed")
      sim.settings.speed = sim.settings.speed >= 8 ? 1 : sim.settings.speed * 2;
    if (id === "team")
      sim.entities
        .filter((e) => selection.includes(e.id))
        .forEach((e) => (e.team = (e.team + 1) % sim!.players.length));
    updateDebug();
  }
  if (action.startsWith("editor-")) await editorAction(action);
  if (action === "install") {
    if (deferredInstall) {
      await deferredInstall.prompt();
      deferredInstall = null;
    } else
      toast(
        "Use your browser’s Install app or Add to Home Screen option. Load once online before offline play.",
      );
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
});
async function pwa() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  const registration = await navigator.serviceWorker.register(
    import.meta.env.BASE_URL + "sw.js",
    { scope: import.meta.env.BASE_URL },
  );
  if (!registration) return;
  let applying = false;
  const show = () => {
    if (registration.waiting) {
      document.querySelector<HTMLElement>("#update")!.hidden = false;
      document.body.classList.add("has-update");
    }
  };
  show();
  registration.addEventListener("updatefound", () =>
    registration.installing?.addEventListener("statechange", show),
  );
  document
    .querySelector("#apply-update")!
    .addEventListener("click", async () => {
      if (sim && (await save("autosave", false)) === false) return;
      applying = true;
      registration.waiting?.postMessage({ type: "APPLY_UPDATE" });
    });
  document.querySelector("#dismiss-update")!.addEventListener("click", () => {
    document.querySelector<HTMLElement>("#update")!.hidden = true;
    document.body.classList.remove("has-update");
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applying) location.reload();
  });
}
async function boot() {
  try {
    await initStorage();
    profile = (await read<Profile>("profile", "main")) ?? freshProfile();
    if (profile.schema !== 1)
      throw Error(
        "Your profile uses an unsupported version. Its data has been preserved.",
      );
    profile.missions = profile.missions.map((id) =>
      id.includes(":") ? id : "rise:" + id,
    );
    settings = {
      ...defaultAudio,
      ...(await read<AudioSettings>("settings", "main")),
    };
    applySettings();
    const errors = campaigns.flatMap(validateCampaign);
    if (errors.length) throw Error(errors.join("; "));
    setView("menu");
    void pwa().catch((error) =>
      console.warn("Offline installation unavailable", error),
    );
    void themes.load(settings.theme, settings.style);
  } catch (e) {
    ui.innerHTML = `<div class="screen"><div class="sheet"><h2>Could not prepare the frontier</h2><p>${escape(String(e))}</p><p>Allow browser storage and reload. Existing saved data has been preserved.</p></div></div>`;
  }
}
void boot();
// Development-only observation surface for browser automation; commands still enter the simulation.
if (import.meta.env.DEV || new URLSearchParams(location.search).has("test"))
  (window as any).frontier = {
    get sim() {
      return sim;
    },
    get renderer() {
      return renderer;
    },
    get themes() {
      return themes;
    },
    get audio() {
      return audio;
    },
    get profile() {
      return profile;
    },
    start,
    save,
    load,
    setView,
    get editor() {
      return editor;
    },
    get settings() {
      return setup;
    },
  };
