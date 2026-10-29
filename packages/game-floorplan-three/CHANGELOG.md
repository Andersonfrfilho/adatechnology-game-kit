# @adatechnology/game-floorplan-three

## 0.3.0

### Minor Changes

- fa6ea00: Structure: a slab or beam is held by the sum of its supports (documented and tested: four columns share the load, each loss moves it to the rest, the
  slab falls when the capacity left is less than the load). New world option `structure: { safetyFactor }` (default 1) multiplies every load before it
  meets the capacities. `game-floorplan-three`: `SpecimenDef.sizing` (`safety`, `redundancy`, `safetyOthers`) sizes a specimen; the frame house of the
  area (`house_casa_portico`) is sized at 0.72 / 0.97 (four pillars: one lost 0.96, two lost fall), so `house_two_pillars` passes with the team's own
  sequence (two pillars) in the real room, and the extended hit sequence the module used as a workaround is gone.
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.

### Patch Changes

- dacab65: O three do núcleo é o `shapeGeometries(THREE)` do game-shapes-three: os modelos de primitiva do acumulador, as unidades da ruptura, os fragmentos, os espelhos e os espécimes da área de teste saem do game-shapes, iguais bit a bit e com cache por parâmetros entre renderizadores.
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
- Updated dependencies [fcd0be6]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [5af569f]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-floorplan-structure@1.1.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-floorplan-residential@3.0.0
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.1

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.0

### Minor Changes

- 1cb7dc8: New package `@adatechnology/game-floorplan-interactables`: the team's `AdaptadorInterativos` ported (plan to objects of the interactables kit, wiring, gas, water, chairs, contents, doors fitted to the walls), every table a registry. `game-floorplan-three` uses it as the default of `interactives` (`adapter` still injects another, `adapterOptions` goes to `create`) and the bridge no longer misreads the plan (`floorY`, `panel`, `mats.floor`).

### Patch Changes

- Updated dependencies [1cb7dc8]
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.1.1

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2
  - @adatechnology/game-floorplan-structure@1.0.5

## 0.1.0

### Minor Changes

- bc11c7f: New package: the three.js renderer of `@adatechnology/game-floorplan` (spec 001, T2.4), a literal port of the team's `Casa3DSDK` and `AndaresSDK`. `create(THREE, options).build(plan)`
  draws walls, doors, windows, floors, slabs, stairs, roofs, gutters, lot, furniture (`game-props3d`), lights, mirrors, cars, solar panels, water and electrical. Each piece knows its vertex
  range in the merged mesh, so the house binds to the destruction of its structure (`game-destruction`, `game-destruction-three`): fracture and collapse hide the range, a masonry wall that reaches
  stage 2 is drawn again as instanced brick courses at LOD 0, and the renderer adds the spall decal and the rebar cage. `createFloorNavigator` is the AndaresSDK (10 cm grid per floor, stairs, occlusion),
  with `navigationDefOf` and `bindNavigator` to register a built house and follow its destruction. The scene equals the page's, node by node, for six plans (golden `vc3-house-scene.json`), and `planLod`
  gives the same levels. Fleet, interactables, vegetation and the mirror's `Reflector` are injected; texts come from `locales` (`en`, `pt-BR`); global `GameFloorplanThree`.
- 4c38dd2: Módulo de teste da casa para a sala de testes (`createFloorplanTestModule`): escolha de pacote, tipologia, semente e estado, casas construídas no mundo de destruição da sala, paredes que barram o jogador, porta com E, andares, nível de detalhe por orçamento, golpes pela bancada e os seis cenários estruturais do time mais um de tipologias.

### Patch Changes

- aa2bc27: The structure spec the house registers in the destruction world keeps what the pieces carry: the water tank holds its 500 L (so a hole leaks) and the gas cylinder explodes; the thin wall (`thickness`, `fill`) and the tags of each come along, so a 9 mm round goes through the tank.
- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-floorplan-structure@1.0.4
