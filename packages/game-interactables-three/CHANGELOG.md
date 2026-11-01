# @adatechnology/game-interactables-three

## 0.1.14

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
  - @adatechnology/game-interactables@0.2.12

## 0.1.13

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-interactables@0.2.11

## 0.1.12

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-interactables@0.2.10

## 0.1.11

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-interactables@0.2.9

## 0.1.10

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-interactables@0.2.8

## 0.1.9

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-interactables@0.2.7

## 0.1.8

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [fcd0be6]
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-interactables@0.2.6

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
