# @adatechnology/game-items-three

## 0.1.6

### Patch Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).
- Updated dependencies [7320d17]
- Updated dependencies [e29f38d]
  - @adatechnology/game-shapes-three@0.1.0

## 0.1.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-interactables@0.2.5
  - @adatechnology/game-items@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-interactables@0.2.4
  - @adatechnology/game-items@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-interactables@0.2.3
  - @adatechnology/game-items@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-interactables@0.2.2
  - @adatechnology/game-items@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-interactables@0.2.1
  - @adatechnology/game-items@0.1.1

## 0.1.0

### Minor Changes

- 32a00c6: New package: the three.js side of `game-items`. Every item of a catalog is drawn at its real size (metres, y up, origin at the bottom centre): the 24 builders of the Itens do Vale Cinzento showcase ported as they are (a golden against the team's three r128 scenes covers each node and the three wear stages), 25 simple shapes for every other item, `setWear` (new, used, spoiled in sRGB), `mergeItem`, `buildItemLod` and the budgets of the page (30 draw calls, 400 / 1200 triangles; 7 models of the team are known deviations). `itemThumbnail`, `shapeThumbnailSvg`, `thumbnailPatch` and `renderItemThumbnail` give every item a picture. `createItemsTestModule` is the items area for the test room: 14 shelves by category at real size, a stand with the 24 models, a 1.55 m ruler and a 1.80 m figure, a finds table, a bench (wear, age and storage of the food, place, container, state, outbreak day, seed, roll finds, recipe, craft), layers, counters and seven scenarios. three is a peer dependency (`^0.160`); the IIFE global is `GameItemsThree`.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [6314632]
- Updated dependencies [50eee43]
- Updated dependencies [3bf868b]
- Updated dependencies [e48ea53]
- Updated dependencies [8d2caad]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-items@0.1.0
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables@0.2.0
