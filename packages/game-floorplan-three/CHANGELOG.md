# @adatechnology/game-floorplan-three

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
