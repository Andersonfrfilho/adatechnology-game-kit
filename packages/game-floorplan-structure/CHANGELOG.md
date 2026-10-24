# @adatechnology/game-floorplan-structure

## 1.0.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-destruction@0.7.1

## 1.0.3

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction@0.7.0

## 1.0.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-destruction@0.6.1

## 1.0.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [aa2c014]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-destruction@0.6.0

## 1.0.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- a2b392a: Installations of the plan (spec 001, T2.2e): `result.utilities` with gas (cylinder beside the stove, in an outside niche or under the counter, or piped with a meter), electricity (service entrance, panel, sockets, switches, circuits, conduits; grid, tap without a meter for a shack, off-grid), solar panels and plumbing; `result.outbuildings` (walls, door, windows,
  furniture and the path to them) and `result.contents` (what each container holds by state, answered by `engine.findsFor` and falling back to the tables of the Visor de casas 3D). The seven lists are equal to the team page in 900 recorded plans.
- 4839020: Wall detail and test walls (spec 001, T2.2d): `toDestructibleSpec` cuts each wall at its windows (piers, sill, reinforced concrete lintel bearing 0.2 m on the piers, wall above) with the
  `game-destruction` assembly of each piece (plaster that spalls, rebar, stages, breach) and keeps the mass of the wall; a door gap gets a lintel that carries the bond beam. `wallDetail: 'units'` lays bricks, blocks and
  concrete panels one by one; log walls are courses of logs. `buildWallSpecimen` builds the 2.4 x 2.1 m test wall of any assembly, whole or with a door or a window.
- 483844f: New package: the structure of every plan from `@adatechnology/game-floorplan` (spec 001, T2.2c). Construction systems (masonry, wood frame, log, improvised, canvas),
  `result.structure` with every part that carries load and what it rests on (foundation, floors, walls, bond beams and plates, pillars, porch posts, trusses or
  rafters, roof, stairs, water tank), `toDestructibleSpec` sized from the loads at rest so a house holds the loss of one pillar and falls with two, and the "Structure"
  layer of the 2D viewer. With `wallDetail: 'coarse'` the structure and the spec are equal to the Visor de casas 3D in 900 recorded plans.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [6314632]
- Updated dependencies [b018548]
- Updated dependencies [483844f]
- Updated dependencies [35fa212]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
- Updated dependencies [eeb9f4e]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-destruction@0.5.0
  - @adatechnology/game-floorplan@0.2.0
