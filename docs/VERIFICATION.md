# Verification record

Verified on October 3, 2026, using Node 24.19.0, pnpm 11.25.0, installed Chrome/Chromium, and a production server beneath `/frontier-command/`.

## Passed checks

- Existing `node_modules` moved to a workspace backup; `pnpm install --frozen-lockfile` installed the complete dependency tree from an empty project dependency directory and ran the esbuild lifecycle successfully.
- `pnpm lint`: Prettier formatting and TypeScript strict checking passed.
- `pnpm test`: 20 tests passed. They cover combat/counters, economy, population, construction, recruitment, technology effects, paused command queues, save/restore determinism, migration and corrupt-save refusal, campaign registry/events, fog, four victory modes, AI armies/attacks/termination, 200 varied generated maps and 40 competitive symmetry maps.
- `pnpm build`: strict type checks, cross-reference content validation, Vite production bundling, deterministic offline worker generation passed.
- `pnpm test:browser`: 12 tests passed in approximately 48 seconds, on desktop 1440×900 and iPhone 13 390×844 Chromium emulation. Tests use the production bundle, not the Vite development shell.
- Real browser checks include movement by keyboard and emulated native touch, actual construction placement, recruitment, unlimited/queued pause behavior, manual save/resume, refresh, campaign launch, editor validation/save/load, settings, achievements, expedition reward persistence, offline editor, offline reload/new match, manifest/scope, and explicit PWA restart with a saved running match.
- The PWA upgrade test installs a real waiting worker, verifies that a match continues without reload, chooses Update & Restart, and resumes the saved match after reload.
- 12 final seeded AI-vs-AI matches terminated with valid economies and functioning production/attacks. Quick durations varied approximately 3.9–15 minutes, including a stalemate resolved by the documented escalation cutoff. These are synthetic bots, not human pacing guarantees.

## Performance sample

`node --import tsx scripts/profile.ts` measured 162 alive entities on a 56×56 map over 500 fixed ticks: mean ~0.95 ms, p95 ~2.03 ms, maximum ~10.82 ms per tick on this workstation. The sample isolates headless simulation and is not evidence of real-phone GPU performance. Screenshots confirmed layout without horizontal overflow at 390×844; representative rendering showed roughly 43 FPS in the headless capture environment.

## Issues found and fixed

First-ever service-worker activation could reload during navigation; reload is now gated by explicit update consent. Offline CSS/JS requests initially failed because of `Vary: Origin` cache matching; same-origin public asset matches now ignore Vary. Mobile update notifications overlapped launch controls; notifications occupy a reserved top strip and can be dismissed. Direct commander movement originally used grid path requests; directional controls now issue deterministic short-lived steering commands for responsive continuous motion.

## Practical limits

GitHub Actions is configured for `https://kjljon.github.io/frontier-command/`; actual remote publication was not performed because no GitHub account/repository connection is available in this workspace. The exact production base path was tested locally. Physical Android/iOS devices and Safari were not available for testing. Pacing remains a tuning concern, particularly the 15–20 minute Standard target; early rushes can end games sooner. Competitive >2-player fairness, high-density collision avoidance and full mission campaign playthroughs by a human remain valuable next work. All requested expansion gaps are documented in README and the system guides.
