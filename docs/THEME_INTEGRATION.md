# Theme integration and Rush Arena

The game consumes a read-only snapshot of the separate `theme-assets` repository. The current imported snapshot is recorded in `public/themes/catalog.json`; `work/theme-import.json` records hashes of source bytes. Never edit the external repository from this game checkout. Authoring folders, tools and its Git history are excluded from production.

## Playing

Choose **Rush Arena** on the main menu, or open an RTS battle's Menu and choose Rush Arena. Pick a commander and seed, then Start Rush Arena. WASD/arrows, taps and the mobile pad move your commander. Q/E/R and the ability buttons trigger abilities. Escorts follow and fight; commanders can fight while steering. Construction, economy and research are replaced by supplies and upgrade choices.

Four commanders enter with four escorts each. Green caches heal living squad members, gold caches add two escorts, and violet caches refresh abilities and briefly empower the squad. Caches disappear once collected. New supplies arrive every 25 seconds, capped at six available caches. Opponents can collect supplies too.

The cyan safe boundary shrinks from radius 9.5 to 1.5 over four minutes. Units outside take increasing storm damage. A red circle warns 2.5 seconds before an incoming strike. Every 45 seconds, the game pauses for an escort, health or overcharge upgrade. Commander defeat permanently eliminates the squad. Last commander standing wins; at the four-minute limit, surviving squad health plus 80 points per collected supply decides the winner. Ties use stable player order. This is single-player against AI, with instant retries.

Arena results do not award RTS achievements, change campaign/expedition progress, overwrite strategy autosaves, or remove strategy saves. When launched inside a strategy battle, Return to RTS battle restores the original in-memory battle, including its pause state. Arena runs themselves are not saved. A browser refresh ends the arena run, while saved RTS battles remain available.

## Applied presentation

World and Style controls switch presentation during either game mode. The five completed starter themes support Toon and Realistic. Selection and audio/motion settings persist. Required art is preloaded before an atomic switch; on failure, the previous theme or Classic Frontier remains playable. Selected runtime assets are cached. Settings also offers Download all worlds for offline play. Large theme files are not part of the service worker's small initial shell cache.

All five themes apply backgrounds, role sprites, six prop roles, command icons, four color/shape faction badges, and distinct ambient/combat music and effect sounds. Two extra faction markers support six-player strategy matches. Themes do not alter strategy rules or terrain collision. Backgrounds are scenery; Rush Arena uses its own explicitly open tactical floor and visible boundary over the illustration.

The snapshot registers separate `game-assets.json` files for Space, Mythic and Christmas: nine canonical characters, eleven buildings, and full/half/sparse/empty gold and wood artwork in Toon and Realistic. Each exact entry is optional and independently falls back to starter art if decoding fails. Relic and camp art is preloaded but its detailed state presentation is a subsequent integration stage. Arena health/crate/ammo SVGs are applied across the five themes. The mini game's escort and energy rules are its own definitions, not additional strategy resources.

Characters remain static poses with procedural movement/recoil/spawn/defeat presentation. No authored directional walk/attack animation is claimed. Sticker art, support terrain/FX sheets, positional audio variants, building-state overlays and additional arena pickup categories are imported where available but not yet enabled by this slice. Old-time/Halloween exact rosters, Street Kids, and authored body animation remain gated until registered and checked. No theme's unfinished art is advertised as complete.

## Updating and adding worlds

1. Read the source `INTEGRATION-HANDOFF.md`, canonical asset specification and per-theme manifests. Work in a separate game worktree. Do not regenerate authoring crops.
2. Run `node scripts/import-themes.mjs <absolute-source-theme-assets-path>`. This reads source bytes and writes only the game's snapshot. Optional exact/arena sidecars are registered in the copied catalog, without modifying source manifests. Explicit pixel rectangles override grid crops. Trimmed sprites retain their original pivots and aspect ratio.
3. Run `node scripts/validate-themes.mjs`. It checks canonical expanded coverage, all referenced files, PNG dimensions, crop bounds, pivots and runtime path containment. The copied starter validator under `work/theme-validation/validate.mjs --partial` can check the starter without writing authoring reports.
4. A new complete world needs an entry in the source catalog plus a valid theme manifest, art and audio. Register its visible name in `src/themes.ts`. Incomplete new worlds such as Street Kids stay hidden. Add optional exact frames by canonical gameplay ID; never change simulation IDs to match a themed name.
5. Keep new styles gated until their roster and files pass checks. Future body animations must sample the delivered frame/pivot/direction/fps/loop contract and synchronize attack release with simulation events. Drawing an animation must never apply damage again.
6. Build, run simulation tests, and verify desktop/mobile presentation, missing-file fallback, all enabled styles, offline switching, mute/volume, reduced motion and large armies. Inspect crops at actual game size.

Audio unlocks on interaction, decodes through Web Audio, loops on sample-frame bounds, and crossfades ambient/combat/theme changes. Stereo frame counts are not divided by channel count. Effects use a 12-voice cap and category throttling; reduced motion suppresses nonessential effects. Full themed sound is original synthesized audio, not recorded orchestration.
