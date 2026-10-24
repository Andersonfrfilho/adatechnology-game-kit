# @adatechnology/game-interactables-three

## 0.1.7

### Patch Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).
- Updated dependencies [ea8b287]
- Updated dependencies [e29f38d]
  - @adatechnology/game-shapes@0.1.0
  - @adatechnology/game-props3d@0.3.0

## 0.1.6

### Patch Changes

- @adatechnology/game-interactables@0.2.5

## 0.1.5

### Patch Changes

- @adatechnology/game-interactables@0.2.4

## 0.1.4

### Patch Changes

- @adatechnology/game-interactables@0.2.3

## 0.1.3

### Patch Changes

- @adatechnology/game-interactables@0.2.2

## 0.1.2

### Patch Changes

- @adatechnology/game-interactables@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [50eee43]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables@0.2.0

## 0.1.0

### Minor Changes

- fdc56f8: Initial release (0.1.0): three.js adapter for `@adatechnology/game-interactables` with a merged-by-material mesh api (animated parts), pose sync, cloth sway with matching shadow materials, pooled smoke/fire/steam/water/spark effects, procedural screens, real-time mirrors and cords.

### Patch Changes

- Updated dependencies [5ad2b1a]
  - @adatechnology/game-interactables@0.1.0
