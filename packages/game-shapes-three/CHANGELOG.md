# @adatechnology/game-shapes-three

## 0.1.0

### Minor Changes

- 7320d17: New package: the three.js side of game-shapes. `toGeometry` (three's type, parameters and prototype), `shapeGeometries(THREE)` (three's geometry constructors made by game-shapes, bit-identical, for ported code), `toObject3D` (meshes per batch, part groups, InstancedMesh, LOD), `createMaterials` and `mergeByMaterial` on the core merge.

### Patch Changes

- e29f38d: The first packages on game-shapes. game-props3d: `createShapeRecorder()` draws the props api (and parts) as a game-shapes schema with the mesh api's arithmetic, and `mergeByMaterial` is now the one of game-shapes-three (re-exported). game-interactables-three: `createMeshApi` bakes through the recorder and `generate`, with the same bytes as before (exact golden of 222 cases) and faster. game-items-three: the kit's `T` is `shapeGeometries(THREE)` and `mergeItem` uses game-shapes-three, with the same bytes (exact golden of 147 cases).
- Updated dependencies [ea8b287]
  - @adatechnology/game-shapes@0.1.0
