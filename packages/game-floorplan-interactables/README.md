# @adatechnology/game-floorplan-interactables

Adapter from the plan of `@adatechnology/game-floorplan` to the objects of the interactables kit (`game-interactables` + `game-interactables-household`). It turns
each piece of furniture of a house into a household object with its doors, drawers, hinges, sockets, switches, lamps, appliances and containers, wires the
house (service entrance, meter, panel, circuits, gas cylinders and pipes, water points), puts chairs around the tables, fills the containers with the finds of the plan and fits the
hinged doors against the walls. Port of the team's `AdaptadorInterativos` v0.3.0 (the names are in `MIGRATION.md`).

No three.js and no game names: the three.js side is `game-interactables-three`, and `game-floorplan-three` uses this package as the default of its `interactives` option.

```ts
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import { create } from '@adatechnology/game-floorplan-interactables'

const adapter = create({ GameInteractables, GameInteractablesHousehold })   // locale 'pt-BR', region 'br': the team's defaults
const planned = adapter.plan(house, { seed: house.seed, night: true })      // items, outlets, switches, lights, cylinders, fixtures, chairs, unmapped...
const world = adapter.createWorld(house, { seed: house.seed })
const out = adapter.add(world, planned, { isBlocked: adapter.blockedOf(house) }) // { added, parts, hinges, moved, warnings }
```

## Everything is a registry

Each table of the team is a default the game can extend, replace or empty (a key with `null` removes the entry), without touching the adapter:

| Option | Table |
|---|---|
| `typeMap` | furniture type of the plan to household type, variant, compound (sink, basin), dimensions, watts |
| `contentMap`, `contentByGroup`, `contentFallback`, `groupOf` | item of the plan to household item |
| `chairTables`, `chairSide`, `chairs` | tables that get chairs |
| `fixturesOfPoint` | plumbing points to fixtures |
| `substitutes`, `preference`, `ownTypes`, `frozenItems`, `drawerItems` | substitutes by type, who takes a stack first, types the adapter builds itself, frozen items, drawer items |
| `locale`, `region`, `messages` | language of the household pack and of the warnings (`en`, `pt-BR`), texts |
| `seedKey` | maps an id to the key of its seeded draws (reproduces another scene's seeds) |

No `Math.random`: every draw is seeded.

## Reading the plan

The adapter reads the plan of the kit (English names, `contents` as stacks of the goods catalog, `utilities` from the structure pack). Without the structure pack there are no
utilities and the house gets furniture only. Lights follow `electrical.mode` (grid, tap, off-grid) and the `night` / `lightsOn` options.

## Tests

`tests/team-golden.test.ts` runs the team's original code (`tests/fixtures/team-golden/adaptador-interativos.js`, verbatim) in a `vm` on the same houses and compares everything
after renaming: the plan of 17 typologies over several seeds and the states fortified and abandoned, the serialization of the world, `add`, `blockedOf`, the chimney and the goods contents.
