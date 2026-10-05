# Theme integration and Rush Arena

The canonical game checkout is `C:/Users/micro/OneDrive/Desktop/J5/dev/projects/game-Frontier-Command`, the folder configured by the Frontier Command project. The separate `theme-assets`, `assets`, and `tools` authoring directories are ignored by the game Git repository and preserved.

The game consumes a read-only snapshot of the separate `theme-assets` repository. The current imported snapshot is recorded in `public/themes/catalog.json`; `work/theme-import.json` records hashes of source bytes. Never edit the external repository from this game checkout. Authoring folders, tools and its Git history are excluded from production.

## Playing

Choose **Rush Arena** on the main menu, or open an RTS battle's Menu and choose Rush Arena. Pick a commander and seed, then Start Rush Arena. WASD/arrows, taps and the mobile pad move your commander. Q/E/R and the ability buttons trigger abilities. Escorts follow and fight; commanders can fight while steering. Construction, economy and research are replaced by supplies and upgrade choices.

Four commanders enter with four escorts each. Green caches heal living squad members, gold caches add two escorts, and violet caches refresh abilities and briefly empower the squad. Caches disappear once collected. New supplies arrive every 25 seconds, capped at six available caches. Opponents can collect supplies too.

The cyan safe boundary shrinks from radius 9.5 to 1.5 over four minutes. Units outside take increasing storm damage. A red circle warns 2.5 seconds before an incoming strike. Every 45 seconds, the game pauses for an escort, health or overcharge upgrade. Commander defeat permanently eliminates the squad. Last commander standing wins; at the four-minute limit, surviving squad health plus 80 points per collected supply decides the winner. Ties use stable player order. This is single-player against AI, with instant retries.

Arena results do not award RTS achievements, change campaign/expedition progress, overwrite strategy autosaves, or remove strategy saves. When launched inside a strategy battle, Return to RTS battle restores the original in-memory battle, including its pause state. Arena runs themselves are not saved. A browser refresh ends the arena run, while saved RTS battles remain available.

## Applied presentation

World and Style controls switch presentation during either game mode. The six themes support Toon, Realistic and Sticker. Selection and audio/motion settings persist. Required art is preloaded before an atomic switch; on failure, the previous theme or Classic Frontier remains playable. Selected runtime assets are cached. Settings also offers Download all worlds for offline play. Large theme files are not part of the service worker's small initial shell cache.

All six themes apply backgrounds, role sprites, six prop roles, command icons, four color/shape faction badges, and distinct ambient/combat music and effect sounds. Two extra faction markers support six-player strategy matches. Themes do not alter strategy rules or terrain collision. Backgrounds are scenery; Rush Arena uses its own explicitly open tactical floor and visible boundary over the illustration.

The current snapshot contains Space, Mythic, Old-time, Christmas, Halloween and Street Kids. Every world/style includes all nine canonical characters, eleven buildings and fourteen resource states. The imported manifest is deliberately small; the catalog points to the generated `game-assets.json` sidecar. The original source manifest remains untouched. Starter roles stay available if optional exact artwork fails. Street Kids uses compatibility starter roles while its complete exact inventory loads.

Movement and attack use four registered frames per facing, two authored facings (NE/SE) and supplied mirrored NW/SW facings. Metadata controls rectangles, pivots, mirroring, frame rate, looping and display-height compensation. Animation time follows simulation time, freezes during pause and falls back to static idle art under reduced motion. Attack effects are cosmetic; rendering never applies damage or changes cooldowns. Idle, hit, spawn and defeat retain static/procedural body fallbacks, as explicitly described by the asset handoff.

Optional presentation streams in without blocking a playable match: authored cycles, foundation/damage/destruction/night overlays, all battle effect sequences, four terrain families, exact command/roster icons, arena pickups/markers and positional sound variants. Terrain aliases resolve forest to grassland and snow to highlands. Simulation terrain and building footprints retain their rules. Full/half/sparse/empty resource families preserve common canvases and pivots. Relic ownership and guarded/cleared camps use their supplied states. Harvest sparks/chips and relic/camp activity stop when exhausted, inactive or cleared.

Arena applies health/crate/ammo art to its three supply rules, spawn/drop markers and winner/elimination artwork. Additional pickup graphics are available to future rules rather than silently granting new gameplay effects. The safe boundary and strike warnings use the actual simulation geometry. Some sticker scenery reuses toon backgrounds. Shared vector building overlays and unrigged 3D proxies retain the limitations recorded in the source handoff.

Audio uses distinct world scores, combat music throughout Arena, 1.2-second theme/mode fades, positional attenuation and stereo panning for mono effect variants, category throttling and a 12-effect voice cap. Audio starts after an explicit interaction; mute and separate volume controls persist. The in-game speaker button toggles mute. Retired music/effect nodes disconnect after playback.

## Updating and adding worlds

1. Read the source `INTEGRATION-HANDOFF.md`, canonical asset specification and per-theme manifests. Work in a separate game worktree. Do not regenerate authoring crops.
2. Run `node scripts/import-themes.mjs <absolute-source-theme-assets-path>`. This reads source bytes and writes only the game's snapshot. Optional exact/arena sidecars are registered in the copied catalog, without modifying source manifests. Explicit pixel rectangles override grid crops. Trimmed sprites retain their original pivots and aspect ratio.
3. Run `node scripts/validate-themes.mjs`. It checks canonical expanded coverage, all referenced files, PNG dimensions, crop bounds, pivots and runtime path containment. The copied starter validator under `work/theme-validation/validate.mjs --partial` can check the starter without writing authoring reports.
4. A new complete world needs an entry in the source catalog plus a valid theme manifest, art and audio. Register its visible name in `src/themes.ts`. Incomplete future worlds stay hidden. Add optional exact frames by canonical gameplay ID; never change simulation IDs to match a themed name.
5. Keep new styles gated until their roster and files pass checks. Additional body animations must sample the delivered frame/pivot/direction/fps/loop contract and synchronize attack release with simulation events. Drawing an animation must never apply damage again.
6. Build, run simulation tests, and verify desktop/mobile presentation, missing-file fallback, all enabled styles, offline switching, mute/volume, reduced motion and large armies. Inspect crops at actual game size.

Audio unlocks on interaction, decodes through Web Audio, loops on sample-frame bounds, and crossfades ambient/combat/theme changes. Stereo frame counts are not divided by channel count. Effects use a 12-voice cap and category throttling; reduced motion suppresses nonessential effects. Full themed sound is original synthesized audio, not recorded orchestration.

## Runtime safeguards

Static runtime cutouts cap their longest edge at 384 pixels. Registered animation/resource families retain common canvases to prevent apparent size changes between frames. Canvas presentation runs at 30 fps on High and 20 fps on Low; simulation and input run independently. Pause stops simulation ticks and event replay. Small screens reserve space for all three abilities and the strategy action buttons.

All theme downloads are stored as independent bytes in the separate `frontier-command:theme-art` IndexedDB database; successful writes await transaction completion. Optional presentation still streams in separate batches after the required roster activates. Download all worlds commits the entire referenced pack to this same database. Theme loading never writes to the service worker’s Cache Storage. Cache reads have a deadline and fall back to the network when storage stalls; writes use a shorter deadline so storage cannot indefinitely block activation. Optional jobs stop when their theme is replaced. The service worker precaches a small shell, catalog and six slim manifests. Versioned theme downloads bypass its shell fetch path. Offline availability depends on successful prior storage; Settings can download the complete pack. Saved strategy battles live in a different IndexedDB database and recovery/update code preserves them.

## Verification

The read-only production pack validator reports six themes, 6,348 referenced files, 3,341 PNGs, 265 WAVs and zero errors. Reports are redirected to `work/production-validation`; the source asset repository is never written. Its six runtime contract tests pass. Game validation checks 9,462 references and 5,994 PNG crop entries. All 35 simulation and animation timing tests pass.

Presentation browser checks confirm actual authored canvases, mirrored reuse, foundation/damage/night states, static reduced-motion fallback, unchanged simulation state, all 20 exact roster images and 20 terrain materials, and Street Kids Sticker Arena with combat music. All 34 desktop/mobile browser checks pass, including all eighteen presentations offline, forced update recovery and arena retries. Eight additional repeated update checks pass. Full-pack offline acceptance and portable-package verification are recorded in the release notes. Large-map profiling on this workstation measured roughly 1.1 ms mean and 2.2 ms p95 per simulation tick with 162 entities on a 56×56 map; this is not a physical-phone GPU measurement. All twelve seeded RTS AI matches finish with both sides winning across the sample.
