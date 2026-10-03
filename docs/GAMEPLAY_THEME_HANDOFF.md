# Gameplay / theme integration handoff

Gameplay branch: gameplay. Theme assets are being authored separately at C:\Users\micro\OneDrive\Desktop\J5\dev\projects\game-Frontier-Command\theme-assets. Read its CODEX-APPLY-PROMPT.md, catalog.json and manifests when integrating a committed asset snapshot. Do not modify or copy its .git directory. Do not rebuild assets using the starter generator: it can overwrite the enhanced manifests.

## Stable gameplay contract

Keep unit/building/resource identifiers and combat balance independent of theme. Map source units to visual roles: archer/ranger/support -> ranged; swordsman/spearman/cavalry/siege -> heavy or the manifest's closest role; commanders -> commander; optional future harvesters -> scout. Preserve distinguishing labels/silhouettes for units that share art. Styles and faction colors are independent settings.

Map resource points have optional capacity, remaining and claimant fields. Simulation supplies finite gold and wood capacity for legacy maps. remaining=0 means exhausted: show an empty mine or stump, no harvest motion, no capture affordance. Preserve the point for save/map compatibility; never reset zero to a full deposit. Income at a captured deposit is automatically harvested; a nearby completed depot increases throughput. Modest keep income remains available to avoid economy deadlocks.

Combat hit events include damage, sourceKind, targetKind, coordinates and target entity ID. They occur once per simulation hit, not per rendered frame. Use these for themed projectiles and impacts, cap effect voices/particles, and respect reduced motion. Depleted events identify exhausted nodes. Keep gameplay time as the presentation clock so tactical pause freezes world animation.

Theme pack currently offers static unit poses and unrigged proxy glTF models. Code-driven recoil/bob/effects are not authored walk/attack animation sheets. Inspect atlas cell bounds and padding before integration. The enhanced environment images are decorative; map tiles remain authoritative for collision and pathfinding.

## Verification

27 simulation regressions cover deterministic maps, combat counters, queues, AI, campaigns, save continuity, destination resumption, building approach, capture ownership, commander respawn and finite deposits. Browser checks should use PORT=4181 for this worktree so port 4180 remains the user's main preview. Run all desktop/mobile checks after the theme presentation is connected.

## Day/night presentation

src/daylight.ts supplies daylight(sim.time): hour, phase (Day/Dusk/Night/Dawn), night (0..1). Cycle is four minutes, starting at morning. Use this clock for theme-specific lighting, lamps or ambient effects. Combat/vision rules stay identical across themes and time of day. Current renderer gently shades terrain, keeps troops readable and glows completed buildings. Resource bars/amounts and exhausted site markers are presentation affordances to preserve during theme integration.

