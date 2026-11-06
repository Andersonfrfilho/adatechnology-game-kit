# @adatechnology/game-floorplan-structure

## 2.1.4

### Patch Changes

- Updated dependencies [a3b0fd7]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-contracts@0.29.0

## 2.1.3

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-destruction@0.18.2

## 2.1.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1

## 2.1.1

### Patch Changes

- Updated dependencies [dbc0ef3]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-contracts@0.26.0

## 2.1.0

### Minor Changes

- f362db3: Structural validation and confined masonry. `validateStructure(structure, { doors, wallDetail })` and `validateSpec(spec)` return what a structure gets wrong as a real building, as typed violations with stable codes (`STRUCTURAL_VIOLATION`: load paths, NBR 6118 sections and steel, beam depth L/10, long beams on masonry, ground beam, pillars at ends, corners, junctions and every 4 m up to the bond beam, bond beam, lintel and sill beam, bonded bricks, plaster on both faces). Masonry houses on strip footings stand on reinforced concrete ground beams (`ground_beam_*`, `GROUND_BEAM_DEPTH`, anchored foundation in the spec; `groundBeams: false` leaves them out), every window gets a sill beam (`_sillbeam_`, `SILL_BEAM_DEPTH`) and lintels and sill beams bear on the jamb pillars, lintels are at least L/10 deep, wide doors get jamb pillars (`jamb_column_*`), short piers keep their jamb pillar, raised tank and balcony pillars are 0.2 m (`TANK_PILLAR_SIDE`; `visorSections: true` keeps the Visor's sections for the team's golden). The house renderer draws the pillars in the walls as structure, plastered a shade off the facade and 2.5 cm out of each face (`BuildOptions.pillars`, `'hidden'` as the Visor drew them).
- bf407ec: A reinforced member cast round its cage (a pillar or beam in concrete blocks) is cut through by a blast only at or near contact (`MEMBER_CUT_REACH`, half the breach reach); further off the blast takes the concrete it reaches out of it block by block and the cage holds it to what it rests on. The bare cage of a pillar keeps what its bars carry (`cageResidualCapacity`: perimeter bars by the steel's crushing strength, halved for buckling) instead of a flat 15%, so the end pillar of a wall stands on its cage under a light bond beam.
- 1a5d6fc: Masonry walls stand on concrete pillars along their length, as in confined masonry: besides the corner pillars, every exterior masonry wall gets a 0.2 x 0.2 m reinforced concrete pillar at its free ends and door jambs, beside each window, where another wall meets it and at most every `WALL_PILLAR_SPACING` (4 m), from the floor to the bond beam, which rests on them (`StructureOptions.wallPillars`, `false` for the corner pillars alone; the free-standing `wallPiece` has four). The house renderer draws them under the wall's plaster: a shot or a blow that takes out the plaster and bricks next to one shows its concrete (and its bars when the concrete goes), the bricks stop at its faces, and a brick wall that falls leaves the pillars and the bond beam standing.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [61a4a79]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [bf407ec]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0

## 2.0.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-destruction@0.16.0

## 2.0.1

### Patch Changes

- 9314e78: Typed floorplan: `Json` is now `unknown`, and the plan records (`PlanDoor`, `PlanWall`, `PlanWindow`, `PlanGate`, `LotPath`, `Lot`, `Facade`), the resolved slots, the walkability grid (`WalkGrid`), the `placeOnFloor` options and the `generate` result (`FloorplanResult`) have their own types. Template-specific fields (`config`, `building`, extension outputs) are `unknown` and narrowed by the pack that writes them. Generated plans are unchanged.
- f5cc423: Tipa as instalações da casa (luz, gás, água, solar, edícula): `Json` vira `unknown`, cada instalação tem o seu tipo exportado e o `src` do pacote fica sem `any`. O `link` de um item aceita o id do fogão (botijão).
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0

## 2.0.0

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [81bd9c0]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-floorplan@0.3.0

## 1.3.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-destruction@0.13.2

## 1.3.2

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [b58423f]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-destruction@0.13.0

## 1.3.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0

## 1.3.0

### Minor Changes

- 2c9c963: Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.

### Patch Changes

- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0

## 1.2.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0

## 1.2.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0

## 1.2.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-destruction@0.8.2

## 1.2.0

### Minor Changes

- 5b69fc2: `wallPiece` and `wallPlan`: a free-standing wall built and drawn as the walls of the houses (the houses' structure without a roof, drawn by the house renderer). `buildStructure` takes `roof: false`. The test room's target wall is now one of them.

## 1.1.1

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1

## 1.1.0

### Minor Changes

- 024d0e8: Real structure (T10, steps 1 and 2). `game-contracts`: `PartSpec.structure.rebar` (`TensionRebar`: `ratio`, `yieldMPa`, `cover`), `PartState.flexure`
  and `PartState.cracked`. `game-destruction`: concrete (C25) and ceramic brick get `MaterialDef.strength` and capacities from the real strengths
  (NBR 6118, NBR 16868-1 slenderness, reinforced columns `0.85 fck Ac + As fy`), so an overloaded bearing wall crushes at the ground floor first;
  beams and slabs with `structure.rebar` bend (`structure.flexure`, scope `'rebar'` by default): the tension face cracks under a blast and the steel
  holds, a plain beam snaps, yielded steel past 10° hinges and the part falls in one piece; `sizeRebar`, `bearingWallThickness`, `buildFrame({ rebar })`;
  `rebar` joints of reinforced parts no longer wear under blows. Documented capacities change (a 30 x 30 cm concrete column now 203 t, a 20 cm brick
  wall 41 t per metre). `game-floorplan-structure`: `toDestructibleSpec({ rebar })` (off by default) declares and sizes the steel of concrete beams
  and slabs (`REBAR_RATIOS`).
- 20cc300: Skyscraper typology (T10 §11), built from the tower systems, soil, piles and wind of the earlier steps. `game-floorplan-structure`: `buildSkyscraper`,
  `skyscraperLayout`, `SKYSCRAPER_DEFAULTS` (storeys, height, bays, facade, plant floor every N, damper, wind, soil, piles, all options), `pilesFor` and
  `PILE_DEFAULTS` (piles sized by the load and the soil), `addPunchedFacade`, relay mechanical floors in `buildTower` (`mechanical.every`), and the room-level
  plan helpers `towerPlate`, `towerFloors`, `exteriorWindows`. `game-floorplan-commercial`: the `office_tower` template (`officeTowerTemplate`,
  `OFFICE_TOWER_DEFAULTS`, `buildOfficeTower`), the `office_open` library. `game-floorplan-residential`: the `residential_tower` template, the `living_tower`
  library and the zone `zt` (towers, 80 storeys, 320 m). Both packs now depend on `game-floorplan-structure` (peer). `game-urban`: opt-in `towers` option
  (`createUrban({ towers })`, off by default and then byte-identical): tall buildings of the block or avenue drawn as towers of the office and residential
  presets, with `minHeight`, `presets`, `mast` and a `provider`; the pack `TOWER_PATTERNS` adds the `financial_district` avenue. `game-destruction`:
  `verticalBarCount`, so a wall or column holds in tension every bar its spacing puts in (the drawn cage is capped; the capacity was not following it, and
  the walls of the core of a tall tower failed in tension). `game-floorplan`: the walkability grid tests only the walls near the room (same result, a tower
  floor no longer costs seconds).
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.
- d24de8a: Soil and foundations (T10 §8). `game-contracts`: `DestructibleSpec.soil` (`SoilProfile`, `SoilLayer`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`) and the `settle` event. `game-destruction`: soil classes with the NBR 6122 basic pressures (`SOILS`), footings as
  elastic-plastic springs (subgrade modulus of a rigid footing, safety 3), piles by Décourt-Quaresma (`pileCapacity`, `pileLength`), and the object as a
  rigid body on them with the 1/200 out-of-plumb and P-delta: it settles, a heavy building on soft soil sinks, leans and tips over, on piles to firm
  ground it holds; `buildFrame({ footing, raft, piles, soil })`; option `soil` (`SOIL_DEFAULTS`). Off unless a spec has `soil`. `game-destruction-three`:
  draws the settlement and tilt under a `destruction-soil` node. `game-floorplan-structure`: `toDestructibleSpec({ soil, foundation, piles, soils })`
  puts the house on a raft (with piles) or on footings under each wall (`RAFT_THICKNESS`, `PILE_AREA`).
- cd2d333: Building systems of tall buildings (T10 §9). `game-contracts`: `PartSpec.contains.outflow` (the direction a fluid leaves a hole: roof water runs
  down). `game-destruction`: `buildFrame({ continuousColumns, columnCage, roofThickness })` (a 20-storey frame stands on continuous columns).
  `game-floorplan-structure`: `buildTower` and `addCore` (reinforced concrete shear-wall tube with stairs and elevator shafts, the strongest part in a
  blast), `addCurtainWall` (glass hung from the slab edges, shatters in large shards), `addFlatRoof` (screed sloped to the drains, EPDM membrane that
  leaks when punctured), `addMechanicalFloor` (elevator machines, water tank, chillers in the load), with `*_DEFAULTS`, `coreSize` and `towerWater`.
- e9a0932: Structure, step 4: wind and sway (gap 5). New world option `wind` (off by default, so nothing changes without it): NBR 6123 pressure that grows with
  height, drag, a wall-and-frame lateral system (walls as a cantilever, columns and T-beams as a shear frame), top deflection and drift against H/500,
  overturning, axial forces from the wind moment, a gusting sway with a tuned mass damper, `world.setWind`, `ObjectState.wind` and the `sway` event.
  `sizeStructure({ wind })` sizes for it; the wind moment tilts buildings on soft soil. `game-floorplan-structure`: `addTunedMassDamper`,
  `DAMPER_DEFAULTS` and `buildTower({ damper, wind })`. Every number is an option with a default and its source in the T10 spec section 10.
- 5af569f: Skyscrapers are limited to 60 storeys by default (owner, 2026-10-25), configurable. `game-floorplan-structure`: `SKYSCRAPER_MAX_STOREYS` (60), the
  default `range` is `[20, 60]` and `SkyscraperOptions.range` raises it. The office and residential tower presets follow it, and the zone `zt` is now 60
  storeys and 240 m. `game-urban`: `towers.maxStoreys` (default 60), per-preset `minStoreys`/`maxStoreys` and `towerPresetOf`.

  `skyscraperLayout` sizes the bays by the wind (`sizeForWind`, default on, above 180 m): a 60-storey tower passes H/500 (1/521) with 14.5 m bays; `false` keeps the raw layout.

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [e4663e1]
- Updated dependencies [1b1d611]
- Updated dependencies [9f7dadf]
- Updated dependencies [d610199]
- Updated dependencies [fa6ea00]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-floorplan@0.2.2

## 1.0.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2

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
