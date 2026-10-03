# Architecture

## Boundaries

`src/simulation.ts` owns the entire match world: entities, queues, resources, orders, combat, captures, fog, mission state, AI and victory. It imports content and grid utilities, never Phaser/DOM/Web Audio/IndexedDB. `step(0.1)` advances a fixed 100 ms tick. The UI collects browser input into `Order` records; the simulation consumes them at the next tick. Paused commands remain queued. Presentation does not drive combat calculations.

`src/renderer.ts` is a Phaser scene with a Canvas texture. It projects world `(x,y)` onto `(x-y, (x+y)/2)`, painter-sorts entities, culls offscreen cells and decor, and draws original terrain, buildings and silhouettes. UI is semantic DOM in `main.ts`, with no DOM element per soldier. `src/audio.ts` synthesizes a bounded set of voices through Web Audio. `src/persistence.ts` owns IndexedDB and aggregate results. `src/map.ts` owns versioned seeded generation, connectivity validation and pathfinding. `src/content.ts` provides typed faction/unit/building/upgrade/biome/achievement/mission definitions. `src/campaigns.ts` is the campaign registry.

AI is a method of the headless simulation because it consumes the same world view and emits the same commands. It has isolated Player planning/memory state and can run with `aiOnly:true`. Future extraction to a separate AI module is straightforward; the current implementation has no rendering dependencies.

## Renderer selection

Phaser was selected over PixiJS. Phaser supplies scene lifecycle, unified mouse/touch input, resize handling, renderer abstraction and headless-compatible separation. PixiJS is an excellent rendering-first scene graph but requires more game lifecycle/input/audio assembly. For this slice, procedural drawing through a Phaser Canvas texture gives a small art pipeline and portable fallback. It does not use React. Web Audio is used directly for original synthesis rather than recorded audio files. Sources investigated: [Phaser input](https://docs.phaser.io/phaser/concepts/input), [Phaser audio](https://docs.phaser.io/phaser/concepts/audio), [Pixi render loop](https://pixijs.com/8.x/guides/concepts/render-loop).

Canvas is currently selected explicitly for predictable generated-art rendering. Phaser's WebGL support is a future optimization; merely switching the renderer would still upload the whole canvas texture. A sprite atlas/batched WebGL scene is the right next step if render profiling demands it.

## Economy and battle

All players receive equal base income and capture income, faction modifiers excepted. Capture requires uncontested presence within 2.6 tiles for approximately six seconds. Owned resource points grant continuous gold/wood; a depot within seven tiles multiplies point income. Houses raise the capped population. Recruitment reserves population while queued. Construction ramps structure health over a definition's duration and grants capacity only at completion.

Counter multipliers are 1.3–1.8 for unit counters, 2.6 for siege against buildings. Upgrades and Rally multiply final damage. Support units heal wounded allies before attacking. Abilities have explicit cooldown state in entities. Commanders return at their spawn after 30 seconds while their team retains a keep.

AI has no resource grants outside scripted campaign actions/survival waves. Difficulty changes planning intervals (8/4/2.5/1.5 seconds). Personalities change attack size, expansion priorities, defenses or counter selection. Vision updates every second. AI remembers last-observed positions and only counts currently visible enemies for composition reactions. Spawn sites and objectives are public map information.

## Determinism and saves

Map randomness is seeded integer PRNG and stable settings serialization. Simulation uses fixed timestep, deterministic iteration and no wall clock/random calls in critical combat. World snapshots include orders, AI planning/memory, research, fog history, triggers, queues, commander cooldowns, stats and wave number. Audio/particles/camera/selection are client presentation. Restore tests advance two copies and compare complete serialized state. IEEE floats prevent promising cross-platform bit-exact lockstep; use an authoritative server initially.

## Paths and performance

Four-neighbor BFS considers water/rock/building occupancy. Paths are generated on orders and throttled pursuit updates, not every render frame. Group orders use offset destinations. Rendering caps particles at 100, audio caps voices at 15 and combat sound rate at ~13/s. Graphics Low removes high-density combat effects. Reduced motion removes bobbing/rings. Simulation correctness remains identical.

Current targeting and path requests still scale with entity count; large-army work should introduce spatial hash buckets, shared destination flow fields and deterministic separation. Huge/Epic supports 160 population by configuration, but this is an architectural ceiling rather than a claim of smooth performance on every phone. The battle result adjudication at 1.5× configured minutes prevents perpetual stalemates; it is visible in objective text after midgame.
