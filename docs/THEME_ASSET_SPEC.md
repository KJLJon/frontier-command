# Frontier Command — complete theme asset specification

This is the production contract for creating assets for **each** world: Space, Mythic, Old-time, Christmas and Halloween. Deliver both Toon and Realistic illustration styles. Keep the existing `theme-assets` pack and its manifests intact until replacements are reviewed. The game consumes a read-only snapshot; asset authoring and game integration are separate jobs.

## The outcome

A player must identify their commander, every troop class, every building function, gold, timber, relics, capture ownership and dangerous attacks at normal game zoom without studying the artwork. Themes change names, appearance, scenery, icons, music and effects. They do not change unit IDs, resource accounting, movement, collision, costs, counters, abilities or victory rules.

The current pack has four shared static unit roles and six shared static prop roles. That is a useful fallback, but it does **not** provide a distinct sprite for all nine playable characters, all eleven buildings, or separate gold and timber sites. This specification fills those gaps. Current sprites and props are single-view illustrations; procedural movement/recoil is not authored animation. Current glTF files are unrigged proxies, not finished characters.

## Delivery priorities

1. **First: resource clarity.** Distinct gold and timber silhouettes, full/partial/exhausted states, harvest action, resource icons, ownership/capture markers and neutral camp/relic art. Resource art must not resemble ordinary scenery.
2. **Second: complete static roster.** One distinct sprite for each of nine characters and eleven buildings. Keep original four-role/six-role assets as fallbacks. Produce usable individual transparent files before attempting a huge atlas.
3. **Third: movement and battle.** Consistent facing directions, actual movement/attack frames, projectiles, impacts, ability effects, damage and defeat states. Validate the animation in motion, not just as a contact sheet.
4. **Fourth: environment and polish.** Terrain families, harvesters, construction/damage stages, day/night accents, UI portraits/icons and extended sound variations. Decorative 3D source models are optional for this Canvas/Phaser game.

Finish each stage in all themes consistently. Report the actual delivered stage; do not call static poses a finished animated roster.

## Rendering and technical contract

| Item | Requirement |
| --- | --- |
| Camera | Fixed elevated isometric / three-quarter view, consistent with the existing pack. No perspective horizon inside a sprite. |
| Ground alignment | Foot/contact pivot is mandatory. Characters stand on the same ground plane; buildings, deposits and props use a bottom-center ground pivot. |
| Runtime scale | The current game uses 48 logical pixels per map tile at zoom 1. Troops draw around 41 px tall, commanders around 57 px, buildings around 78 px, HQ around 108 px, resource props around 53 px. Inspect at these sizes and at 390 px mobile width. |
| Units | Prefer 256×256 source cells. Start with individual PNG cutouts. Small props/units may use 128×128 cells when details remain readable. |
| Buildings/resources | Prefer 512×512 source cells. Larger HQs may use 768×768. Preserve aspect ratio; no stretching to fill a square. |
| Texture limits | Prefer sheets no larger than 2048×2048. Split by unit/state/style. Do not put an entire animated roster into one enormous sheet. |
| Alpha | Real RGBA transparency. No painted black/white/checkerboard background, baked UI, ground plate or exterior shadow crossing into other cells. |
| Padding | At least 8 source pixels around the complete silhouette, including spears, bows, hats, capes, exhaust and weapon swings. More for large effects. |
| Atlas metadata | Give exact PNG dimensions and explicit `pixelRect` for every irregular crop. Explicit bounds override nominal row/column grids. Include pivot in the crop's own coordinate space. |
| Trimming | Preserve the untrimmed pivot. Record trim offset and original size if exporting trimmed frames. Keep the same pivot across every animation frame. |
| Filtering | Use independent cutouts or extruded atlas padding to prevent neighbors leaking into a frame. No mipmaps across unpadded cells. |
| Lighting | Neutral readable base lighting. Material detail must survive night shading. Strong glows are separate optional overlays. |
| Factions | Keep body artwork neutral enough to reuse. Team color goes on rings, shapes, banners, shields, cloth panels or a separate accent mask—not an uncontrolled tint over the entire image. |
| File names | Lowercase ASCII, hyphenated names, canonical IDs below. Paths resolve relative to the owning `theme.json`. |
| Ownership | Original assets or clearly documented reusable licenses. Record source, generation prompt and limitations. No commercial game asset extraction. |

## Exact character roster — nine per theme/style

These canonical IDs already exist in the game. Every row needs an identifiable silhouette, portrait and unit icon. Preserve its functional identity even if a themed name changes.

| ID | Function and required visual distinction |
| --- | --- |
| `swordsman` | Short-range armored infantry. One-handed melee weapon plus visible shield/armor silhouette. |
| `spearman` | Anti-cavalry infantry. Long spear/pike or clearly elongated equivalent; cannot look identical to swordsman. |
| `archer` | Fragile long-range attacker. Bow, rifle, blaster or themed ranged weapon; firing direction is clear. |
| `cavalry` | Fast heavy raider. Mounted/riding/vehicle silhouette distinct from infantry. |
| `siege` | Slow long-range anti-building unit. Large launcher/catapult/cannon silhouette and a distinctive heavy projectile. |
| `support` | Heals friendly troops and has a ranged attack. Staff, medical equipment or helper silhouette distinct from archer. |
| `warlord` | Durable melee commander. Large readable leader silhouette; charge, ally rally, personal protection. |
| `ranger` | Fast ranged commander. Scout/sharpshooter silhouette; dodge, slowing/snare field, ranged volley. |
| `engineer` | Tactical commander. Tool/equipment silhouette; deploy turret, repair pulse, siege blast. |

Suggested interpretations retain the same mechanics:

| Role | Space | Mythic | Old-time | Christmas | Halloween |
| --- | --- | --- | --- | --- | --- |
| Swordsman | Shield trooper | Armored knight | Riot guardsman | Toy shield soldier | Skeleton guard |
| Spearman | Energy-pike trooper | Spear guard | Bayonet pikeman | Candy-cane pikeman | Graveyard halberdier |
| Archer | Laser trooper | Bow ranger | Musketeer | Candy archer elf | Pumpkin spell shooter |
| Cavalry | Hover rider | Mounted rider | Scout motor carriage | Reindeer rider | Spectral horse rider |
| Siege | Rocket walker | Rune catapult | Steam cannon | Gift launcher | Coffin catapult |
| Support | Medic drone | Grove healer | Field medic | Cocoa healer elf | Friendly lantern spirit |
| Warlord | Fleet captain | Crowned warlord | Regiment officer | Santa commander | Vampire commander |
| Ranger | Recon captain | Forest huntress | Scout officer | Trailmaster elf | Bat huntress |
| Engineer | Reactor mechanic | Rune engineer | Brass artificer | Workshop foreman | Pumpkin inventor |

These are art-direction suggestions, not permission to rename gameplay IDs or invent new unit mechanics.

### Character animation package

Deliver an inspectable first pass with four directions (NE, SE, SW, NW); the complete target is eight directions (N, NE, E, SE, S, SW, W, NW). Do not silently mirror asymmetric equipment as an authored opposite view.

| State | Target frames/direction | Playback |
| --- | --- | --- |
| Idle | 4 | Subtle 3–6 fps loop; stable feet and scale. |
| Move | 8 | 10–14 fps loop; clear foot/vehicle motion. |
| Attack | 6–8 | 12–16 fps one-shot; mark windup, release/impact and recovery frame indices. |
| Hit | 2–3 | Brief one-shot; no large positional jump. |
| Spawn | 4–6 | One-shot materialization/arrival; optional effect overlay instead of body frames. |
| Defeat | 6–8 | One-shot fall/disassembly/fade; optional final wreck/corpse frame. |
| Commander ability | 6–8 per applicable ability | One-shot body animation paired with a separately reusable effect. |

Metadata must include frame rectangles, direction order, frames per state, fps, loop flag, pivot and event/release frame. No combat timings belong in artwork metadata: the simulation still decides when damage occurs.

## Exact building roster — eleven per theme/style

Do not reuse the same barracks illustration for every production/research building. A player needs to recognize the function before selecting it.

| ID | Functional silhouette requirement |
| --- | --- |
| `keep` | Dominant headquarters; largest landmark, command banner, protected entrance. |
| `house` | Compact housing/population structure. Visually smaller than production buildings. |
| `barracks` | Infantry recruitment. Weapons/training/armor cue. |
| `range` | Ranged recruitment. Targets, bows/rifles, firing lane or range cue. |
| `stable` | Cavalry recruitment. Animal pens, vehicle docks or hangar cue. |
| `workshop` | Siege recruitment. Heavy machinery/launcher construction cue. |
| `tower` | Tall defense/scouting structure. Readable firing point and projectile origin. |
| `depot` | Harvest logistics/storage. Crates, carts, containers or stacked materials. Must not look like a resource deposit. |
| `blacksmith` | Military research. Forge, workbench or technical-upgrade cue. |
| `arcane` | Support/healer recruitment. Magical, medical or helper-training cue. |
| `wall` | Short blocking fortification segment. Clearly distinguishable from decorative perimeter scenery. |

Required building states: foundation/under construction, completed, damaged and destroyed rubble. Completion/damage can use separate overlays for an economical first pass. Provide optional working loops for forge fire, antennae, windmills, flags or workshop motion. Tower/HQ need attack/flash overlays. Provide warm-window or emissive night overlays separately from daytime art. Record the ground footprint and projectile attachment point; decoration never changes the game's collision footprint.

## Resource and objective package — highest priority

Resources must be obvious without color alone. Use labels, distinct silhouettes and type icons together. Keep accounting IDs `gold` and `wood`; themed display names may include the accounting term, such as **Reactor ore (Gold)** or **Salvage (Timber)**.

| Canonical ID | Required art and behavior cues |
| --- | --- |
| `gold` | Mine/deposit entrance or clearly valuable ore pile; mining tool/cart; gold/ore icon. Full, partially harvested and exhausted states. |
| `wood` | Harvestable tree grove or material stockpile with a distinct trunk/log shape; chopping/collection cue; timber icon. Full, partial, sparse and cleared/stump states. |
| `relic` | Tall unique landmark with controlled glow; visibly different from a mine or pile. Neutral, contested, captured and inactive states. |
| `camp` | Neutral guard camp; warning/guard silhouette and cleared camp variant. Never looks like an automatically harvesting site. |

Suggested themed resources:

| World | Gold-equivalent site | Timber-equivalent site | Relic | Camp |
| --- | --- | --- | --- | --- |
| Space | Ore excavation and mining drone | Salvage field/material crates | Ancient signal beacon | Rogue-drone outpost |
| Mythic | Rocky gold mine and ore cart | Tree grove, logs and stumps | Rune obelisk | Raider encampment |
| Old-time | Ore/coal excavation and mine cart | Lumber yard and timber stacks | Clockwork monument | Bandit workshop |
| Christmas | Glowing crystal/gift mine | Fir grove and workshop timber | North-star monument | Mischievous toy camp |
| Halloween | Glowing ore/candy-crystal cavern | Haunted tree grove and stumps | Moonlit rune shrine | Mischievous monster camp |

For **each** resource type/style provide:

- One transparent full site, at least two depletion stages and a clearly empty/exhausted site. Site variants must share the same footprint and pivot.
- One flat resource icon at 24/48/96 px and a separate worker/tool/cargo cue.
- A one-shot collection sparkle/puff, a harvest loop and a depletion puff. Do not bake numbers, reserve bars or ownership colors into the site image.
- Optional gatherer sprites: mining, chopping, carrying and idle. These are cosmetic harvesters until the game implements independent worker units; do not introduce worker selection/population or new gathering rules in the asset pack.
- Reusable type-specific ground decal/outline. The game's label, remaining amount, ownership marker and capture progress stay above the art and remain visible at night.

Acceptance: show four sites beside ordinary rocks/trees/buildings, in grayscale and at mobile zoom. An unfamiliar player must pick gold, timber, relic and camp immediately. A depleted site must read as empty before selecting it. Dense woodland must never hide its harvest banner or amount label.

The game currently has gold, timber and relic influence. Additional economy types such as crystal, food or energy are **future optional assets**, not implemented resource systems. Supply those only in a separately labeled expansion folder.

## Battle effects and ability inventory

Effects must be separate transparent sprites or procedural-friendly shapes. No embedded target body, scenery or UI. Keep the contact origin and direction clear.

Required general effects: melee slash/impact, spear thrust/impact, ranged muzzle/release, ranged projectile/trail/impact, heavy siege projectile/trail/explosion, healing pulse, shield/protection glow, slowing field, spawn flash, unit defeat, building collapse, mining/chopping/collection, resource depletion, capture ring/burst and selection/order marker.

Required commander effects:

| ID / ability | Required effect |
| --- | --- |
| Warlord / Charge | Forward streak, contact shockwave; keep destination clear. |
| Warlord / Rally | Ally banner/aura pulse. |
| Warlord / Iron resolve | Personal shield/armor aura. |
| Ranger / Dodge | Short displacement afterimage. |
| Ranger / Snare field | Distinct slowing ground field. |
| Ranger / Volley | Multiple ranged streaks and impacts. |
| Engineer / Deploy turret | Deploy/build pop with turret materialization. |
| Engineer / Repair pulse | Repair/heal sparks, distinct from damage sparks. |
| Engineer / Siege blast | Heavy blast/shockwave and building impact. |

Use 128×128 or 256×256 effect cells, 6–12 frames and explicit duration/pivot/blend mode. Supply low-effects variants or permit the game to use one static flash/ring. Respect reduced motion: no required camera shake, large spin, screen-wide white strobe or unreadable persistent fog. Cap overlapping effects in the game; do not solve intensity by making every sprite enormous.

## Terrain and decorative scenery

The game has four biome families: grassland, highlands, desert and swamp. Each supports open ground, forest/slow terrain, marsh/slow terrain, blocked water and blocked rock. Themes may reinterpret materials but must keep the passability categories recognizable.

Deliver one low-contrast tile/material family for each gameplay terrain category; matching transition/edge pieces where available; small rocks, grass/debris, shrubs, trees, stumps, water ripples and ambient accents. Keep shadows consistent. Decorative clutter cannot resemble a mine, wall segment, enemy or objective.

Retain the current two battlefield illustration backgrounds per theme, one per style. They are decorative backdrops only. Do not bake traversable paths, harvest sites or gameplay buildings into a background and expect the simulation to follow them. Scenery must not scroll independently as if it were authoritative collision geometry.

Day/night: deliver neutral/day base materials plus optional warm windows, lamps, reactor/crystal glows and fire overlays. The game supplies a continuous four-minute cycle and readable night shading. Day, dusk, night and dawn may have separate ambient accents; whole-screen darkness must not hide units or reserve labels.

## Interface, portraits and faction identity

Provide nine unit/commander portraits, eleven building icons, four resource/objective icons, six existing command icons (`attack`, `move`, `defend`, `resource`, `ability`, `victory`) plus select, hold, recruit, research, build, pause/resume, cancel, rally, help and defeat icons. Provide distinct icons for nine commander abilities and the six existing research upgrades.

Use SVG for simple interface glyphs or transparent 96/128 px PNGs for detailed illustrations. Preserve accessible text labels; never bake English labels or hotkeys into an icon. Glyph silhouettes must work at 20–24 px. Keep typography and button layout in the game.

At least four factions must be distinguished simultaneously: azure diamond, ember triangle, jade circle and violet square. The game supports up to six players; supply amber pentagon and rose hexagon as recommended extensions. Rings/markers, badges and banners are independent of world, art style and the three gameplay faction rules. Provide masks/neutral accent areas if creating recolorable clothing or buildings. Ordinary art colors are not team colors.

## Audio package

Retain each world's distinct long exploration score and separate combat score. Space: airy electronic exploration and pulse combat; Mythic: harp/flute/woodland percussion; Old-time: brass/clarinet/clockwork; Christmas: major chimes/sleigh jingles; Halloween: organ/music-box/chromatic spooky motifs. Original compositions only.

Required existing sound IDs: `select`, `move`, `attack`, `impact`, `spawn`, `collect`, `victory`, `defeat`, `ui-confirm`, `ui-back`.

Next required variations: 3–5 melee impacts; 3–5 ranged impacts; siege launch/explosion; building damage/collapse; mine/chop/carry; resource depleted; capture/contested; construction start/complete; research complete; heal/repair; shield; and cues for the nine commander abilities. Record category/variant metadata rather than changing canonical gameplay events.

Technical requirements: PCM16 44.1 kHz WAV masters; stereo music, mono positional effects; exact sample rate, channels, loop start/end frame indices and duration. Loop frame bounds are **not interleaved channel sample counts**. Verify both ends for clicks/gaps. Music should leave headroom for combat; no clipping in individual files or a test mix. Default music/effects controls start at .35/.65 before master gain. The game unlocks audio on user interaction, caps effect voices, throttles duplicate events, varies repeated impact pitch, persists mute/volumes and crossfades moods/themes for approximately 1–2 seconds.

## Manifest and directory contract

Preserve the existing schema, four `sprites` roles, six `props.entries` roles, style crop overrides, palette, faction badges, icons and audio metadata. New exact assets are additive. Never remove a working fallback. Existing explicit Christmas/prop crop corrections must survive rebuilding.

Suggested layout per theme:

```text
<theme>/theme.json
<theme>/graphics/units/<style>/<canonical-id>/<state>.png
<theme>/graphics/portraits/<style>/<canonical-id>.png
<theme>/graphics/buildings/<style>/<canonical-id>-<state>.png
<theme>/graphics/resources/<style>/<id>-<stage>.png
<theme>/graphics/effects/<style>/<effect-id>.png
<theme>/graphics/terrain/<style>/<category>.png
<theme>/graphics/icons/<icon-id>.svg
<theme>/audio/music-background.wav
<theme>/audio/music-combat.wav
<theme>/audio/<event>-<variant>.wav
<theme>/THEME-NOTES.md
```

Place exact asset metadata in a new optional `gameAssets` section of `theme.json`. This is the contract for the next adapter; the current four-role adapter remains valid. Do not claim new fields are consumed until integration is tested.

```json
{
  "gameAssets": {
    "schemaVersion": 1,
    "units": {
      "spearman": {
        "displayName": "Energy pikeman",
        "styles": {
          "toon": {
            "atlas": "graphics/units/toon/spearman/move.png",
            "animations": {
              "move": {
                "fps": 12,
                "loop": true,
                "directions": ["NE", "SE", "SW", "NW"],
                "frames": {
                  "SE": [
                    {"pixelRect":{"x":0,"y":0,"width":256,"height":256},"pivot":[0.5,0.86]}
                  ]
                }
              }
            }
          }
        }
      }
    },
    "resourceSites": {
      "gold": {
        "displayName": "Reactor ore (Gold)",
        "styles": {
          "toon": {
            "full": {"file":"graphics/resources/toon/gold-full.png","pivot":[0.5,0.88]},
            "half": {"file":"graphics/resources/toon/gold-half.png","pivot":[0.5,0.88]},
            "empty": {"file":"graphics/resources/toon/gold-empty.png","pivot":[0.5,0.88]}
          }
        }
      }
    }
  }
}
```

The example is illustrative: a real manifest must enumerate every delivered frame, direction, style and state. Use the same entry conventions for `buildings`, `effects`, `portraits` and `terrain`. A standalone PNG still needs an explicit pivot. Metadata should declare missing/fallback states honestly.

## QA and acceptance checklist for every theme

- All nine characters and eleven buildings are visually distinct at game scale; role fallback use is reported explicitly.
- Full/partial/empty gold and timber, relic and camp are recognizable in color, grayscale, day/night and mobile views.
- Inspect individual PNG crops and a contact sheet; no neighbors, clipped weapons, hidden background, moving pivots or inconsistent scale.
- Inspect animations playing continuously, including direction changes and attack release/impact timing. No duplicated still poses advertised as animation.
- Test all four required faction colors **and shapes** over every terrain material. Check selected outlines and health bars without tinting artwork.
- All paths resolve relative to manifests. Explicit crop bounds remain inside actual image dimensions. Validate alpha, audio headers/loop points and optional model data.
- Audition ambient→combat→ambient, theme changes, mute and volume changes; record any synthesis/mixing limitations.
- Test reduced motion, low effects, missing-file fallback, rapid theme/style switches, offline downloaded themes and representative 200-unit battles in the game.
- Deliver gallery PNGs at source and gameplay scale, short animation previews, an inventory/validation report, source prompts/licenses and per-theme notes. These reports belong in authoring/review folders, not production asset URLs.
- Commit complete stages often in the asset repository. Do not edit the game worktree or reset someone else's files.

## Prompt to give the theme creator

> Read this entire specification and the existing CODEX-APPLY-PROMPT.md. Keep canonical gameplay IDs and existing working manifest fields. First complete the resource/objective package, then distinct static art for the nine characters and eleven buildings in each theme/style. Preserve corrected pixel rectangles and pivots. Add actual animation states, effects, icons and sound variations in separately validated stages; label static poses and procedural motion honestly. Put new exact assets in an additive gameAssets manifest section, with explicit paths, frames, pivots and fallbacks. Work only in the asset repository, commit focused stages, produce contact sheets and motion previews, validate every manifest and report what remains incomplete. The game integrator owns renderer, simulation and UI changes. Never regenerate over hand-corrected crops without preserving them.
