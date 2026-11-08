# @adatechnology/game-vegetation-three

## 0.3.12

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.3.11

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0

## 0.3.10

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.3.9

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0

## 0.3.8

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.3.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.3.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.3.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.3.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.3.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.3.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.3.1

### Patch Changes

- fd68284: No `any` in the three.js adapters of interactables, vegetation and urban: they take three's own types (`typeof THREE`, `Object3D`, `IUniform`, `HTMLCanvasElement`). New exported types: `SwayMaterial` and `UrbanLight`.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-vegetation@0.2.1
  - @adatechnology/game-shapes-three@0.3.1

## 0.3.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-shapes-three@0.3.0

## 0.2.8

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.2.7

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0

## 0.2.6

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.2.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

## 0.2.4

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.0

### Minor Changes

- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 3be5d21: Testes e ferramentas no three r160 (o pacote do three passa a pedir `>=0.160.0`); os goldens que o r160 muda foram regravados uma vez: torno dos pneus (ordem dos índices), cores misturadas no espaço linear, um tampo extrudado pelo earcut 2.2.4 e as cores do terreno urbano.

### Patch Changes

- c7e2f21: O cenário, os colisores e o caminhante do viveiro, e a camada de colisores, passam pelo `shapeGeometries` do game-shapes-three: mesmos bytes do three (goldens exatos), com cache por parâmetros.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-shapes-three@0.1.1

## 0.1.0

### Minor Changes

- 2645d90: Novo pacote `game-vegetation-three` (spec 001, T7.2c): `createVegetationTestModule` e `loadVegetationTestModule` põem na sala as 18 plantas do módulo do Viveiro (mangueiras de três tamanhos, ipê, coqueiro, bananeira, araucária, árvore morta, hibisco, cerca viva, rosa, girassol, três cactos, dois vasos, touceira) como itens do mundo de destruição padrão, com uma malha por peça, espessura real da madeira, juntas, âncoras e o clipe de vento, e as 13 provas `veg_*` da página do time, literais (machado nos troncos de 15 e 30 cm, junta tronco-galho, serra, machete, faca, 9 mm, isqueiro, caminhada na grama). A bancada planta o canteiro de 12 x 20 m (`scatterRulesFor` + `scatter` + `buildLot`) com semente, qualidade, detalhe, condição e estação, regula o vento e liga o caminhante que dobra as plantas; camadas de colisores, caixas das peças e eixos da madeira. `examples/vegetation-test-area` e o módulo também na `interactables-test-area`.

### Patch Changes

- Updated dependencies [0b3c030]
- Updated dependencies [54419e4]
  - @adatechnology/game-vegetation@0.2.0
  - @adatechnology/game-vegetation-species@0.2.0
