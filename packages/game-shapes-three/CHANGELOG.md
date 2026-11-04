# @adatechnology/game-shapes-three

## 0.3.1

### Patch Changes

- 106c0f5: No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.
- Updated dependencies [106c0f5]
  - @adatechnology/game-shapes@0.2.1

## 0.3.0

### Minor Changes

- 455522d: `createCord` and `catenary` move to `@adatechnology/game-shapes-three` (spec 005, D1), so the weapons no longer reach into `game-interactables-three` for them. `game-interactables-three` keeps both exports, `@deprecated`, delegating to the new ones; they are removed in the next major.

### Patch Changes

- Updated dependencies [24b4981]
  - @adatechnology/game-shapes@0.2.0

## 0.2.0

### Minor Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.

## 0.1.1

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.

## 0.1.0

### Minor Changes

- 7320d17: New package: the three.js side of game-shapes. `toGeometry` (three's type, parameters and prototype), `shapeGeometries(THREE)` (three's geometry constructors made by game-shapes, bit-identical, for ported code), `toObject3D` (meshes per batch, part groups, InstancedMesh, LOD), `createMaterials` and `mergeByMaterial` on the core merge.

### Patch Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).
- Updated dependencies [ea8b287]
  - @adatechnology/game-shapes@0.1.0
