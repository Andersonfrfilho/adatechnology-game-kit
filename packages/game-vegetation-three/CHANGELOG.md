# @adatechnology/game-vegetation-three

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
