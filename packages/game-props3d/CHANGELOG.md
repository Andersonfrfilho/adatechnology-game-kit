# @adatechnology/game-props3d

## 0.3.1

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [fcd0be6]
  - @adatechnology/game-shapes-three@0.1.1

## 0.3.0

### Minor Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).

### Patch Changes

- Updated dependencies [7320d17]
- Updated dependencies [ea8b287]
- Updated dependencies [e29f38d]
  - @adatechnology/game-shapes-three@0.1.0
  - @adatechnology/game-shapes@0.1.0

## 0.2.0

### Minor Changes

- 50eee43: Novo `@adatechnology/game-animals-three` 0.1.0 (spec 001, T4.3b e T4.4b): porte literal dos construtores dos Bichos do Vale (`quad`, `bird`, `snake`) e da animação, com os visuais vivo, infectado e morto para as 13 espécies, as vistas de juntas e aberta, e o módulo de teste `createAnimalsTestModule` (`?area=animals`). O `game-props3d` ganha `createNodeSkin` e `collectReferencedNodes`: uma malha de GPU que representa uma árvore inteira de peças, para muitos bichos numa chamada de desenho.
- 32a00c6: `mergeByMaterial(THREE, root, space)`: joins the meshes of an object by material (one mesh per material, matrices baked into the given space). It moved here from `@adatechnology/game-weapons-three` so that the item models can use it too. `three` is an optional peer dependency.

## 0.1.0

### Minor Changes

- 3563fe0: Initial release (0.1.0): 57 procedural low-poly prop builders that only describe primitives through a host-provided api, ported to TypeScript with English naming and an `en` / `pt-BR` locale table.
