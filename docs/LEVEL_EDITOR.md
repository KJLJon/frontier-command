# Frontier cartographer

Open Level editor from the menu. It begins with a valid generated map. Choose the brush and tap the battlefield to paint/place. Desktop middle-drag or phone drag pans; zoom controls/scroll adjust scale.

Choose biome to change palettes and terrain modifiers. New map dimensions apply when **Generate new terrain** is chosen, avoiding silently truncating an edited map. Generation replaces the draft; Save or Export first if you want to keep it.

Brushes include open/forest/marsh/water/rock; resource banners, relics, camps, player spawn points; every building and unit. Owner is the player index (0 human, 1+ AI). Team alliances for editor maps currently follow separate owner IDs; coalition configuration is available in skirmish, and editor alliance fields are a future extension. Spawn placement updates the chosen player location. Erase removes placed objects at a cell, while terrain painting changes the tile itself.

Save uses the map name as key. Load lists saved maps. Clone duplicates the draft and appends “copy” to its name; Save persists it separately. Export downloads full JSON; Import validates JSON and rejects invalid dimensions/terrain or unknown entities. Victory selector controls Conquest/Domination/Relic Hunt/Survival. Play map validates before starting a live battle; return to the editor from the menu to continue the draft.

Validation flood-fills each spawn and flags blocked/unreachable objectives/resources/spawns, inadequate local gold/wood, inadequate expansion area and invalid terrain placements. It does not yet simulate building-footprint connectivity or guarantee competitive balance. Avoid closing every route with walls. Resources must be reachable and within 40% of the map dimension for a viable starting economy.

JSON fields: version, settings, tiles (row-major terrain codes), spawns, points (kind/owner/progress), optional placements (kind/team/x/y/building), optional victory. Exported maps are a stable interchange format; schema changes need a migration/version bump.
