# Offline, storage isolation and GitHub Pages updates

The canonical hosted address is https://kjljon.github.io/frontier-command/. Vite, the manifest identity/start URL/scope, assets and production service worker all use `/frontier-command/`. Development does not register a worker.

## Isolated browser storage

Every new persistent store uses the `frontier-command` namespace:

- IndexedDB `frontier-command:storage`, version 2: saves, maps, profile and settings. Its existing name is preserved, so saved battles and preferences need no migration.
- IndexedDB `frontier-command:theme-art`, version 1: independently committed art, audio and theme metadata. Keys are same-origin `/frontier-command/themes/` URLs with imported snapshot versions.
- Cache Storage `frontier-command:<build hash>`: the small offline shell. Activation removes only this app's cache prefix and keeps one prior shell. Asset fallback searches only this app's caches, never global caches owned by other PWAs.
- Manifest identity and worker scope: `/frontier-command/`.

There are no game settings in unprefixed localStorage/sessionStorage. Same-origin sibling PWAs retain their databases, settings, cache contents and worker registrations. The worker handles only same-origin GETs inside the Frontier Command directory.

Older local releases used `frontier-theme-art`. If it already exists, the loader reads matching Frontier theme entries and copies them on demand into the namespaced database. It never creates, writes or deletes that old database. This preserves downloaded art for offline upgrades. Browsers without database enumeration redownload art when online.

Storage is per origin: localhost saves/preferences do not automatically appear on kjljon.github.io. Browser eviction/private browsing can remove data. Export important authored maps; save synchronization is not implemented.

## Offline operation

Installation downloads the complete small shell: HTML, bundled game/campaign code, CSS, icons, manifest, recovery page, catalog and six compact theme manifests. Failure leaves the previous worker intact. No required CDN fonts or runtime third-party requests are used.

Required theme art is stored before activation; optional animation, terrain, effects and audio stream afterward. The theme database is separate from the shell. Versioned art requests bypass shell caching. Load the desired presentation once online, or use **Settings > Download all worlds** for the entire referenced pack. Completion awaits successful storage writes. An unavailable theme retains a working presentation/fallback.

## Online update lifecycle

1. Register `sw.js` with `updateViaCache: none` on launch. Check again on reconnect, when the page becomes visible, and every five minutes while online and visible. Suppress overlapping checks; offline failures do not interrupt play.
2. A changed worker downloads the new shell before becoming installed. A background download does not replace the running match.
3. A dismissible **Update available** banner offers **Update & Restart**. The worker waits for that explicit request.
4. Save the strategy battle first. Withhold activation if saving fails. Arena runs remain unsaved.
5. Request activation and retry idle-worker failures. If activation stalls, use the static `/frontier-command/recover.html?restart=1` page, preserving the original game URL. It exists on GitHub Pages without a custom route. Recovery uses fresh HTML online with a cached offline fallback and preserves IndexedDB data.
6. Recover/register the canonical worker and return to the game. If another open Frontier tab blocks completion, recovery offers a retry action. Continue resumes the strategy autosave. Updates never clear other PWA storage or registrations.

New theme snapshots load versioned required art when selected after restart, followed by optional assets. Shell updates do not force a full-world redownload; Download all worlds is the explicit option for complete themed offline coverage.

The standalone server retains the older `/frontier-command-recovery/` alias for legacy local recovery tests. Production updates use the static in-project recovery file.

## CI and deployment

`.github/workflows/pages.yml` uses Node 24 and locked pnpm. Main pushes and manual runs check source, run simulation tests, validate the imported snapshot, build Vite assets and the offline worker, and run desktop/mobile browser tests. Only a successful artifact is deployed through GitHub Pages Actions. Pull requests run checks without publishing or receiving deployment permissions.

CI builds committed `public/themes`. It does not read the ignored external `theme-assets` authoring repository or generate unfinished sheets. When the generator completes a batch, import it into the game, validate it, and commit the game-owned snapshot; the next main push publishes it.

Pages source must be **GitHub Actions**. The artifact includes runtime art/audio, needs no backend, and remains below Pages' 1 GB site limit.

## Verification

Browser regressions cover offline reload/new matches, saved settings/battles, all eighteen presentations offline, ignored-worker recovery, later updates waiting for approval, legacy art-cache migration, a foreign PWA's cache poisoning attempt/storage retention, and reconnect-triggered downloads without reloading a battle. These use actual service workers, IndexedDB and Cache Storage.
