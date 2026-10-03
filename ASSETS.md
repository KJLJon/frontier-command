# Assets and licenses

All game art and audio were authored programmatically for this project. No assets were copied from commercial games or downloaded from third-party media libraries.

| Asset | Source | Distribution status |
|---|---|---|
| Terrain, trees, rock, buildings, unit silhouettes | `src/renderer.ts` procedural Canvas drawing | Original project content |
| Selection, banners, particles, projectile strokes | `src/renderer.ts` | Original project content |
| Icon SVG and raster PWA icons | `public/icon.svg`, `scripts/icons.mjs` | Original project content |
| Music: menu/exploration/tension/combat/victory/defeat | `src/audio.ts` original note patterns and oscillator synthesis | Original project composition |
| UI, hit, construction, capture, ability, heal and destruction sounds | `src/audio.ts` oscillator synthesis | Original project sound design |
| Campaign story/definitions and gameplay data | `src/content.ts` | Original project content |
| Screenshots | Captured from this game by `scripts/screenshots.mjs` | Original project content |
| Fonts | Operating-system serif/system sans-serif fallback | No font files distributed |

Original project source/content is released under the MIT license in LICENSE. Dependencies retain their licenses. Phaser: MIT; Vite: MIT; TypeScript: Apache-2.0; Playwright: Apache-2.0; tsx: MIT; esbuild: MIT. Lockfile records exact dependency versions. Runtime distribution bundles Phaser; development tooling is not precached or needed for offline play.
