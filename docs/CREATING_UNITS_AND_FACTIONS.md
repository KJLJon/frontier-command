# Units, buildings, technologies and factions

`src/content.ts` is the content catalog. Its TypeScript types enforce required fields; `scripts/validate.ts` checks cross references and numerical values. UI lists are derived from definitions.

## Unit

Add an entry to `units`:

```ts
halberdier:{name:'Halberdier',hp:140,damage:18,range:1.7,speed:1.9,
 rate:1.2,gold:65,wood:20,pop:2,time:12,building:'barracks',tag:'spear',vision:5}
```

Health, damage, range, movement speed, attack interval (`rate`, seconds), gold/wood cost, population, recruitment time, production-building ID, counter tag and vision are mandatory. Recruitment automatically discovers this definition and checks its building. Production buildings support five queued units and rally points. Existing tags implement spear/cavalry/ranged/infantry/siege/support roles. New counter interactions belong in `combatDamage`; test them. Healing currently uses the `support` kind specifically: a new healer must extend that behavior. New unit silhouettes can be added in `Renderer.entity`; otherwise the default soldier is functional.

## Faction

Add a faction entry with a name, display color, team mark, player-facing description and multiplicative `hp`, `speed`, `cost`, `income`. These modifiers apply when entities are created, during movement, on recruitment costs, and on economy respectively. All setup menus auto-populate. Team colors remain cyan/orange with ◆/▲ so faction identity does not obscure allegiance. Faction visuals currently branch between Ironhold stone, Wildborn timber colors and Arcanist violet stone. Add an art style in the renderer for a new faction; the definitions do not pretend to supply a fully unique roster.

Unique faction rosters/prerequisites are not implemented. A future `availableUnits`/`availableBuildings` field should be filtered in recruitment/AI/UI together. Do not restrict only the visible button: command validation must enforce content access.

## Building

Add health, gold/wood cost, build time, description and optional `requires`, `pop`, `range`, `damage`. Prerequisites reference another building ID. Houses and keeps contribute population only when complete. Attack buildings use range/damage. Placement is restricted to passable unoccupied ground near friendly forces. Economy depot behavior currently references the `depot` kind; specialized building roles should become data fields as more equivalents arrive.

## Technology and commander

Technology definitions include cost, prerequisite and display branch. Effects are explicit simulation hooks for `economy`, `armor`, `weapons`, `range`, `commander`, `logistics`; a new effect needs a type/handler/test rather than just a menu entry. All upgrades reset per match.

Commander definitions supply stats, vision, three ability labels and description. Ability handlers are isolated in the UseAbility command. New commanders require matching structured ability behavior and tests. Commander spawning and UI otherwise discover definitions automatically.
