# Seeded maps and terrain

Map generator version 1 hashes the serialized settings with the seed and feeds an integer Mulberry-style PRNG. Input includes dimension, players, biome, preset, resource abundance, roughness, water, camps, objective density and weirdness. Preserve field order when exchanging settings; versioned JSON exports preserve the canonical order. Same version and complete settings produce identical maps.

Dimensions 20–72 are supported by the engine; UI offers Tiny 24, Small 28, Medium 36, Large 48, Huge 56. Players range 2–6 for skirmish. Spawns lie on a radial ring. Each gets open ground and nearby gold/wood, connected by carved corridors to the center. Expansion resources and relics also get guaranteed corridors. Camps avoid spawn proximity. Terrain remains seeded around these connectivity guarantees.

Competitive disables spawn jitter and places expansions radially. Two-player Competitive adds exact 180-degree rotational terrain/spawn/resource symmetry. Balanced/Wild/Chaotic permit terrain variance; weirdness changes forest distribution and spawn jitter. Competitive with >2 players uses equal initial economy and radial starts; distance/fairness beyond those guarantees needs more analysis before tournament use.

`validateMap` flood-fills each spawn, checks usable expansion area, nearby reachable gold/wood, opposing spawns, objectives, dimensions, terrain values and placement passability. Generation repairs connectivity by construction, deterministically; failed validation throws rather than silently shipping a broken map. There is no nondeterministic retry. Future obstruction families should use a deterministic attempt counter mixed into the seed and return the winning version/attempt.

Terrain codes: 0 open, 1 forest, 2 marsh/slow, 3 water/blocked, 4 rock/blocked. Four-neighbor BFS paths consider static blocking buildings. Forest/marsh movement uses the biome slowdown; forest biome also reduces vision. Snow globally changes palettes and slow-terrain penalties. Desert improves vision and lowers income. There are no naval units/bridges in this slice.

To add a biome, add a definition in `biomes`: display name, ground/light/forest/water colors, `slow`, `vision`, `resource`. Menus and terrain renderer discover it. New terrain-specific behaviors need an explicit rule in passability/movement/build validation. Avoid renderer-only rules that make an apparently blocked tile traversable.

Tests generate 200 heterogeneous seeds plus additional competitive symmetry cases. Use `pnpm test` and `pnpm balance` after generator changes. Bumping generation version is required for any algorithm change after a public release; do not promise old seeds reproduce with a changed version. Saved matches contain their full map, so generator upgrades do not modify existing battles.
