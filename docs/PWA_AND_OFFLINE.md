# Offline and updates

Vite builds at `/frontier-command/`. The manifest's identity, start URL and scope are that exact subdirectory; icons are relative. `main.ts` registers `BASE_URL + sw.js` with `scope: BASE_URL`. Production only; development has no worker.

`scripts/sw.mjs` walks the completed `dist` output, hashes both assets and worker generator, and writes a cache-first worker. It precaches HTML, bundled JavaScript (including campaign definitions), CSS, icons and manifest. Procedural graphics/audio are in the bundle, require no third-party requests, and work offline after Web Audio's first user gesture. There are no remotely loaded fonts or CDN libraries.

Cache names are `frontier-command:<build hash>`. Fetch handling only accepts same-origin GETs beneath the app prefix. Cached asset lookup ignores `Vary` because every served asset is same-origin public immutable application content; navigation ignores query strings and falls back to the cached index. Uncached non-navigation content uses the network. The worker never handles sibling GitHub Pages applications.

## Lifecycle

1. Installation downloads every shell asset with `cache.addAll`. Failure prevents installation and leaves the working active worker intact.
2. A newer installed worker waits. There is no automatic `skipWaiting`.
3. UI displays a dismissible **Update available** banner, outside the game's controls. It never forces a running match to reload. First-ever activation does not reload.
4. **Update & Restart** awaits an IndexedDB autosave of the current world. If saving fails, activation is withheld and the player sees an error. A successful save posts `APPLY_UPDATE` to the waiting worker.
5. The worker calls `skipWaiting`, claims the client on activation, and the consenting page reloads on `controllerchange`. The player can choose Continue to resume the autosave.
6. Cleanup removes only Frontier Command caches and retains one prior version. It never opens/deletes IndexedDB. Browser storage eviction remains outside app control.

## Storage

IndexedDB `frontier-command:storage`, version 2, has saves/maps/profile/settings object stores. Save snapshot schema 2 includes map, settings, entities, economy, queues, commands, fog history, mission triggers and results state. Schema 1 migration preserves values and fills new defaults; unknown versions are refused without deleting them. Storage failures are shown and existing data preserved. Campaign missions in profile use namespaced IDs. Settings and expedition state are persisted independently.

Manual save currently uses one replaceable slot; autosave is separate. Map saves are named and can be cloned. Cloud synchronization and export/import of game saves are future features; map JSON export already works offline. Private browsing/OS eviction can remove data, so important authored maps should be exported.

## Verify locally

Run `pnpm build`, then `node scripts/serve.mjs` or the Playwright production server. Load `/frontier-command/`, wait for worker activation, reload once, switch DevTools to Offline, reload again, start a battle, save it, open a campaign/editor/settings and return through Continue. `pnpm test:browser` includes real Chromium network-offline tests. Inspect Application → Manifest/Service Workers for exact scope and icons.

For update testing: keep the old page open, build a new version, call registration.update() or reopen online, observe the banner, continue playing without reload, choose Update & Restart, then resume autosave. Never delete caches/saves as a workaround for a migration bug.
