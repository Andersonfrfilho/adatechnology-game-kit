# @adatechnology/game-kit-defaults

## 0.3.3

### Patch Changes

- Updated dependencies [32547af]
  - @adatechnology/game-floorplan-residential@8.0.0
  - @adatechnology/game-urban@0.5.2

## 0.3.2

### Patch Changes

- Updated dependencies [81e70aa]
  - @adatechnology/game-contracts@0.37.0
  - @adatechnology/game-destruction@0.29.1
  - @adatechnology/game-audio@0.15.1
  - @adatechnology/game-crowd@0.6.1
  - @adatechnology/game-destruction-three@0.26.1
  - @adatechnology/game-fluids@0.6.6
  - @adatechnology/game-fluids-three@0.6.1
  - @adatechnology/game-render-three@0.4.1
  - @adatechnology/game-runtime@0.3.1
  - @adatechnology/game-shapes@0.4.1
  - @adatechnology/game-terrain@0.9.1
  - @adatechnology/game-terrain-three@0.6.3
  - @adatechnology/game-urban@0.5.1
  - @adatechnology/game-vfx-three@0.10.5
  - @adatechnology/game-workers@0.1.1

## 0.3.1

### Patch Changes

- 92a5504: While a loading task is open, the covered container has `aria-busy="true"`.
- Updated dependencies [30a8199]
  - @adatechnology/game-urban@0.5.0

## 0.3.0

### Minor Changes

- 334489c: `world.ambient`: a luz de preenchimento (`HemisphereLight`) do host, para o jogo que fixa a hora escalar a intensidade junto com o sol, sem procurar a luz pelo nome na cena.
- c71e079: Colisores fixos pelo coordenador de workers (spec 009, T10): `staticCollidersKind` (`destruction.static-colliders`, faixa `build`) com o núcleo puro `measureStaticPart`, que agora mede também no quadro principal; `RendererOptions.workers` (e `debris.workers` na sala) entrega as peças ao coordenador, opt-in porque a medida da sala não pagou. O preset hospeda a categoria.
- 18bd23f: As formas passam pelo coordenador de workers (spec 009, T11): `shapesGenerateKind` (`shapes.generate`, faixa `build`, entrada `./worker-kinds`) e `createShapePool({ workers })`; o `size`/`spawn` antigo continua como legado. O preset inclui a categoria em `KIT_WORKER_KINDS`.
- dc3ad20: `createKitWorld(THREE, options)` na entrada `/world` (spec 011, T1.3): o host do mundo monta renderer, sol, terreno, mundo e renderizador da destruição, líquidos, som com oclusão, efeitos, orçamento de luzes, física (Jolt por padrão), workers, agendador com as fases da sala e o laço. Liga por padrão o marca-passo da explosão, a política D4 dos destroços e o chão no worker (só com workers de verdade); cada um desliga por `false`. `game-physics-jolt` e os adaptadores usados passam a dependências; `three` é peer.
- 0095c76: Host do mundo (`/world`, spec 011 T1.5): `createKitWorldSync`, o mesmo mundo sem esperar a física (o solver do kit, um `PhysicsLoop` ou uma `SeamWorld` do jogo), para quem devolve o mundo na hora, como o `createTestRoom`. A física aceita uma `SeamWorld` (`physics.pieces`, `info.physics.kind: 'seam'`). `onSound` no topo das opções ouve todo som, também num mundo mudo; `audio.engine` carrega as gravações num motor do jogo. `ground.showBlow` (o que um golpe no chão mostra e toca, para um golpe que o jogo aplicou) e `ground.resetFire`; `liquids.filmRandom`; `isLooping`; `probeOf`, `DEFAULT_GROUND_LAYOUT` e `GROUND_BURST_MAX` exportados. Uma `SeamWorld` do Jolt passada ao `createKitWorld` é reconhecida como seam (não carrega um segundo motor).
- 23534c3: O indicador de carga (`createLoading`, `KitLoading`, `loadingMarkup`, `LOADING_CSS`, `nextPaint`) passa a morar em `@adatechnology/game-kit-defaults/world`, ao lado de `createKitWorld`: um jogo mostra o mesmo cartão da sala enquanto monta o mundo. A sala de teste usa e reexporta de lá com os nomes antigos (`RoomLoading`), sem mudança de comportamento.
- 232c3a6: Workers ligados por padrão (spec 009, T6, T7 e T13): `createKitWorkers` e `KIT_WORKER_KINDS` no preset, com o arquivo do worker do kit (`dist/kit-worker.js` e `dist/kit-worker.global.js`); o chão da cratera vira a categoria `destruction.ground-tiles` (`groundTilesKind`, entrada sem three.js `./worker-kinds`) e passa pelo coordenador com `createCoordinatorGroundPort`. A sala usa um coordenador por página, com o chão por ele por padrão (`?groundWorker=0` desliga, `?workers=N` escolhe quantos).
- 02e9999: `@adatechnology/game-kit-defaults/world`: entrada nova com `createObjectRegistry` (registro de objetos do mundo: entrar, sair, segurar, soltar, achar) e `createReportPort` (relatos tipados do mundo). A sala de teste registra os objetos dela ali; o comportamento não muda.

### Patch Changes

- Updated dependencies [c88deea]
- Updated dependencies [96c27a1]
- Updated dependencies [737b677]
- Updated dependencies [f693949]
- Updated dependencies [cd5113c]
- Updated dependencies [ff1a27b]
- Updated dependencies [b0a370f]
- Updated dependencies [c71e079]
- Updated dependencies [f1c7229]
- Updated dependencies [c4783d3]
- Updated dependencies [10f2df0]
- Updated dependencies [e3a9ee8]
- Updated dependencies [51c7f3d]
- Updated dependencies [78ac539]
- Updated dependencies [5e05bb2]
- Updated dependencies [18bd23f]
- Updated dependencies [f17aebb]
- Updated dependencies [85870f8]
- Updated dependencies [3b22fa3]
- Updated dependencies [08c5801]
- Updated dependencies [6fb91f5]
- Updated dependencies [c8b5c71]
- Updated dependencies [8ebd34c]
- Updated dependencies [fc1310c]
- Updated dependencies [b37d94f]
- Updated dependencies [556586e]
- Updated dependencies [6cc4abe]
- Updated dependencies [20cdc73]
- Updated dependencies [adf4811]
- Updated dependencies [e987bbe]
- Updated dependencies [f9d5dbc]
- Updated dependencies [3a0d4fb]
- Updated dependencies [6356f68]
- Updated dependencies [232c3a6]
- Updated dependencies [65b522a]
- Updated dependencies [1fede95]
- Updated dependencies [6473d97]
- Updated dependencies [a4637d8]
- Updated dependencies [b3fb084]
- Updated dependencies [f7de1ec]
- Updated dependencies [ca2dac7]
- Updated dependencies [5da32ec]
- Updated dependencies [1807dd8]
- Updated dependencies [631d9d0]
- Updated dependencies [da15205]
- Updated dependencies [c394683]
- Updated dependencies [8d26913]
- Updated dependencies [232c3a6]
  - @adatechnology/game-destruction-three@0.26.0
  - @adatechnology/game-physics-jolt@0.2.0
  - @adatechnology/game-contracts@0.36.0
  - @adatechnology/game-destruction@0.29.0
  - @adatechnology/game-terrain@0.9.0
  - @adatechnology/game-physics@0.2.0
  - @adatechnology/game-workers@0.1.0
  - @adatechnology/game-crowd@0.6.0
  - @adatechnology/game-shapes@0.4.0
  - @adatechnology/game-render-three@0.4.0
  - @adatechnology/game-audio@0.15.0
  - @adatechnology/game-fluids-three@0.6.0
  - @adatechnology/game-urban@0.4.0
  - @adatechnology/game-runtime@0.3.0
  - @adatechnology/game-vfx@0.16.0
  - @adatechnology/game-fluids@0.6.5
  - @adatechnology/game-terrain-three@0.6.2
  - @adatechnology/game-vehicles-fleet@7.0.0
  - @adatechnology/game-vfx-three@0.10.4
  - @adatechnology/game-floorplan-residential@7.0.0

## 0.2.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- ba6dd38: `game-stories` has new optional options (spec 005, D1 and D7): `names` and `ruleset` on `createStoryWorld`, `simulateStories`, `createSheet`, `drawSheet` and `createStoriesTestModule`, and `professionName` on `createStoriesTestModule`. Without them nothing changes: the name pools come from `getNamePools(locale)`, the ruleset from `SHEET_RULESET` and the profession names from `getProfession`, all of `game-characters-people`. The default is deprecated and will be removed in the next major. The schema types (`NamePools`, `SheetRuleset` and friends) are exported by `game-stories`. Recommended path: spread `defaultStoryContent(locale)` of `@adatechnology/game-kit-defaults`.
- 7abe6b1: `game-urban` has two new optional options (spec 005, D1 and D7): `createVehicleProvider({ ids })` and `createPlantProvider({ pickSpecies })` take the fleet and the species by option. Without them nothing changes: `ids` still defaults to `PARKED_VEHICLE_IDS` and the species still come from the `region` table of `game-vegetation-species`. The default is deprecated and will be removed in the next major; `PARKED_VEHICLE_IDS` and `region` are `@deprecated` too. Recommended path: `defaultUrbanProviders()` of `@adatechnology/game-kit-defaults`, or your own `ids` and `pickSpecies`.

  `game-urban-three`: `createPlantResolver({ toSpec })` and the `providers` and `plantSpec` options of `createUrbanTestModule` are new and optional; the defaults (`toSpec` of `game-vegetation-species`, the providers of `game-urban`) are deprecated and will be removed in the next major.

### Patch Changes

- Updated dependencies [f48b676]
- Updated dependencies [7abe6b1]
  - @adatechnology/game-urban@0.3.0
  - @adatechnology/game-vehicles-fleet@6.0.0
  - @adatechnology/game-floorplan-residential@6.0.0
