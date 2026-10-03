# Frontier Command collaboration boundary

Updated 2026-10-03. The user has another GPT Work chat producing graphics and a theme system. Avoid overlapping edits.

## Graphics/theme chat
Own graphics assets, sprite sheets, theme definitions, src/art.ts, and src/renderer.ts. Coordinate before editing src/main.ts, src/style.css, src/content.ts, or shared configuration.

## This gameplay chat
Own simulation/resource mechanics in src/simulation.ts and src/map.ts and focused gameplay tests. Leave graphics/theme files untouched while the other chat works. Coordinate shared UI edits before implementation.

## Existing art draft
src/art.ts is an original, unintegrated procedural sprite-atlas draft from this chat. It is not imported by the current renderer. The graphics chat may reuse or replace it; no further edits to it are planned here.

## Safe integration
Prefer the graphics chat returning assets/new modules or working in a separate copy. Merge specific files; never replace the whole app folder or restore an older full snapshot. Announce changes to shared files before touching them. Run the build and browser checks after integration. Do not rebuild or replace dist concurrently with another build.

This document is a proposed ownership boundary, not an automatic file lock. The other chat must receive/read it to honor it.
