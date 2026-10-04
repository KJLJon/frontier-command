# Frontier Command playable slice — 2026-10-04

The release includes a single-player strategy game and a separate four-minute Rush Arena. The canonical source is C:/Users/micro/OneDrive/Desktop/J5/dev/projects/game-Frontier-Command, configured by the Frontier Command project.

## Delivered

- Six worlds: Orbital Rush, Runestone Rally, Brass Battalion, North Pole Dash, Midnight Mayhem and Block Party Blitz. All support Toon, Realistic and Sticker.
- Complete nine-character and eleven-building themed rosters; four-frame movement and attack cycles with registered pivots and mirrored facings. Animation and effects follow simulation time and freeze during pause.
- Readable finite gold/wood deposits with full/half/sparse/empty states, reserves, ownership and depletion feedback. Captured sites harvest automatically; additional worker mining is a future gameplay expansion.
- Day/night lighting, foundation/damage/destruction/night building states, terrain materials, harvest activity, relic/camp states, combat sequences, exact action icons and positional sound variants.
- Rush Arena with four squads, finite healing/reinforcement/energy supplies, closing storm boundary, telegraphed strikes, timed upgrades, win/defeat results and retries. Returning to an RTS battle preserves it.
- Saved strategy battles, campaign/expedition progression, editor, achievements, statistics, touch controls, reduced motion and persistent audio controls.
- Small offline app shell, safe explicit updates and saved-battle recovery, with an uncached recovery-page fallback when worker activation stalls. All theme bytes use committed transactions in a separate IndexedDB database; required art activates first, then optional presentation streams in. The full-pack download also commits optional files for complete offline rendering. Versioned art requests bypass the shell's cache path.
- Portable built package and Windows launcher. No dependency installation is needed to play; Node.js 22.12+ or 24 must already be available.

## Verification

- Production build, formatting and TypeScript checks passed.
- All 35 simulation/animation tests and all 34 desktop/mobile production browser tests passed (final browser run: 5.2 minutes).
- Eight additional repeated update checks passed, including forced ignored-worker messages, saved-battle restoration, and subsequent background updates waiting for a new explicit request.
- Both platforms switched all 18 world/style combinations during play and offline, retaining all 20 roster entries and 14 resource states. Missing-file fallback, reduced motion, audio preferences, battle results, retries and legacy blank-shell recovery passed.
- Full-pack download acceptance passed: all 18 presentations completed optional art/audio loading offline, and Street Kids Sticker reloaded offline.
- The read-only source validator reported six themes, 6,348 references, 3,341 PNGs, 265 WAVs and zero errors; all six source runtime contract tests passed. Game validation passed 9,462 references and 5,994 PNG crops.
- All twelve seeded RTS AI matches finished, with both sides winning across the sample. A 162-entity, 56�56-map profile measured approximately 1.1 ms mean / 2.2 ms p95 per simulation tick on this workstation.

Imported source snapshot: `1d76e608a18f5dda`; normalized game snapshot: `13b0ca5fdd60ee0b`. Final app bundle: `index-Bp0YCXt1.js`; offline shell: `f93934283c22`. Runtime changes are committed through `9977070`; the documentation commit records this release. The portable archive is CRC-checked and supplied with a SHA-256 checksum. Its local server was smoke-tested independently without development dependencies.

## Boundaries of this slice

This is a playable vertical slice, not a multiplayer or commercial full release. Unit movement/attack have four frames and two authored facings plus two mirrors. Idle is static; hit/spawn/defeat body motion falls back to procedural presentation. Eight separately authored directions, longer cycles, full body states and rigged 3D models remain future asset work. Some sticker scenery reuses toon backgrounds; shared vector building overlays retain the source handoff's limitations.

The arena applies three delivered pickup categories to existing rules; additional pickup art does not introduce extra mechanics. Arena runs are not saved. Background illustrations are scenery, and the arena's playable floor/boundary has explicit simulation geometry. Physical-phone GPU performance has not been measured; touch regressions use mobile emulation.

Offline play requires a successful prior asset load or Settings → Download all worlds. Browser storage remains subject to available capacity and eviction. The supplied local server can serve all packaged files without an internet connection.

## Asset collaboration

The separate theme-assets authoring repository remains read-only. Game integration imports a snapshot into public/themes and normalizes game-owned manifests into compact manifests plus sidecars. No authoring graphics, metadata or tools were overwritten. The delivered source pack passed its production validator with zero errors.

## Launch

Extract Frontier-Command-Playable.zip completely, then double-click PLAY.cmd and keep its server window open. Open http://127.0.0.1:4180/frontier-command/ if needed. Choose New skirmish or Rush Arena. In the live preview, click Pause to resume the prepared Street Kids Sticker arena. WASD/arrows move; Q/E/R trigger abilities. How to play documents strategy controls.
