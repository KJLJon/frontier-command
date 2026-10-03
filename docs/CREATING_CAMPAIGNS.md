# Creating campaigns

Campaigns are typed data; the engine interprets a finite vocabulary of triggers and actions. No mission contains executable scripts.

## Add a campaign

1. Create `src/campaign-content/pirates.ts`. Import `Campaign` from `../content` and export a `Campaign` object. Use globally unique campaign ID and mission IDs within that campaign.
2. Import it in `src/campaigns.ts` and append it to `campaigns`. The campaign tabs automatically discover registered entries. Each definition selects a default faction and commander.
3. Run `pnpm typecheck`, `pnpm test`, `pnpm build`. The tests/build validation script checks all registered campaigns, connections and spawn definitions. Do not bypass validation.
4. Play every mission at normal speed, test a loss and resume, then test offline. Starting a mission embeds its complete definition in the save, so continued games keep their saved content even after a campaign update.

```ts
import type {Campaign} from '../content';
export const pirates:Campaign={
  id:'pirates',title:'Corsairs of the March',
  description:'A two-chapter sample across the southern frontier.',
  faction:'wildborn',commander:'ranger',
  missions:[{
    id:'shore',title:'A Foothold',story:'Captain: Claim the old road before dawn.',
    objective:'Destroy the rival keep.',mode:'Conquest',biome:'desert',
    size:28,difficulty:'Normal',reward:1,next:'beacon',
    modifiers:{gold:500,wood:400,enemyFaction:'ironhold'},
    triggers:[
      {when:'time',value:45,actions:[{type:'dialogue',text:'Lookout: Riders on the ridge!'},
        {type:'spawn',team:1,unit:'cavalry',count:3}]},
      {when:'capture',value:1,actions:[{type:'resources',team:0,gold:150,wood:100}]}
    ]
  },{
    id:'beacon',title:'The Beacon',story:'Hold the light against the storm.',
    objective:'Earn 1,000 influence.',mode:'Relic Hunt',biome:'forest',
    size:32,difficulty:'Hard',reward:2,triggers:[]
  }]
};
```

## Fields

`Campaign`: ID, title, description, faction ID, commander ID, missions. `Mission`: ID, title, story dialogue, objective text, mode, biome, dimension, difficulty, renown reward, optional next mission ID, triggers and optional starting-resource/enemy-faction modifiers. The sample authored campaign is in `src/content.ts`. UI unlocks each sequential chapter after its predecessor; `next` is validated as a connection but branching authored unlock rules are a future extension. The expedition is the implemented branching mode.

By default, missions use seeded procedural layouts with `<campaign ID>-<mission ID>` as the seed. Set optional `seed` to choose a specific map. To use a fully authored map, export JSON from the editor and attach it as the mission's optional `map: MapData` field. The launch handler uses its exact tiles, placements, spawns and settings; build-time validation checks it. `import layout from './ironwatch.json'; map: layout as MapData` is sufficient after importing the type from `../map`. An existing saved mission contains its full layout and remains independent of later generator changes.

## Trigger vocabulary

Triggers fire once, in definition order, and their indices are serialized.

| `when` | `value` interpretation |
|---|---|
| `time` | Match seconds elapsed |
| `capture` | Player 0's cumulative newly captured points; other teams' owned relic count |
| `kills` | Player 0 cumulative defeated units |
| `resources` | Chosen team's gold threshold |
| `region` | Any alive chosen-team entity enters `region:{x,y,r}` (`value` unused) |
| `destroyed` | Entity ID whose health is zero or lower |

`team` defaults to 0. Stable semantic IDs for authored entities and separate unit-killed event predicates are future extensions; current destroyed triggers use runtime entity IDs. Avoid depending on IDs in layouts that may change.

| `type` | Fields and behavior |
|---|---|
| `dialogue` | `text`, transient battlefield message |
| `objective` | `text`, changes active objective instruction |
| `resources` | `team`, `gold`, `wood`, grants economy |
| `spawn` | `team`, `unit`, `count`, optional `x,y`; otherwise chosen spawn |
| `reveal` | `team`, marks terrain explored; does not expose invisible enemies |
| `alliance` | `team`, `other`; copies other's alliance ID |
| `victory` | `team`, declares winner |
| `defeat` | `team`, declares opposing side winner (two-side authored encounters) |

## Rewards, story and unlocks

Campaign wins grant the mission's renown, record `<campaign ID>:<mission ID>` completion, and unlock the next chapter. The launch dialogue is `story`; follow-up dialogue belongs in triggers. Statistical achievements use the generic results framework. Persistent options are renown spending and expedition relics; faction/commander archetypes are available from the start to evaluate the slice.

To add new enemies, create unit/faction definitions first. To add a new trigger or action, extend the union type, validator, interpreter and tests together. Content must not inject JS/eval or access browser storage directly. Per-mission objective text should match the actual victory mode or an explicit structured victory trigger.
