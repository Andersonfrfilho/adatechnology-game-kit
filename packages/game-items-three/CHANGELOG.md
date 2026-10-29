# @adatechnology/game-items-three

## 0.2.0

### Minor Changes

- dba2c82: Add 89 kit-authored low-poly models (lot B) at real size: clothing and protection, bags and containers, electronics, radio and light, fuel and energy, field, fishing and hunting, books and magazines, history and collectibles, and keys and access items. They are registered in `SHIPPED_MODELS` and `data/models.json` (scale 1, the team box is the real size in metres).
- d796b0f: Add low-poly 3D models for the 133 lot A items (food, drinks, medicine and first aid, tools, melee and silent weapons, building and crafting materials). Each model is drawn to the item's real size and reads by silhouette (bottles with neck and cap, cans with rims, tools with handle and head).
- 69ccd0b: Cans are described by family, not by model: `data/destruction.json` lists `families` (`drink_can` in aluminium, `food_tin` in steel), each with its models and one rule, and `itemDestruction(modelId)` / `itemFamily(modelId)` look the rule up (one function, so an item-category system can feed it later). Adding a model to a family is one id. The rule takes `food` as a skin tag too, so what a tin shows of its contents (the sauce of the beans) is drawn on the shell and never breaks off as a loose red block. The `contents` of the data say what each model holds (soda, beer, a sauce, brine, oil, condensed milk as honey); `itemContents` sizes it from the item (inner volume of the shell, the fill of the model, never more than the item weighs), `buildItem({ destructible: true })` writes it on the shell part and the items test area declares it as the item's `fluid`, so a bullet hole makes the can leak. `tagForDestruction` now takes an options object (`modelId`, `weight`, `size`).
- 642f290: `buildItem` takes `destructible: true`: each mesh gets the `game-destruction` material of its kit tag (`DESTRUCTION_MATERIAL_BY_TAG`), and models listed in `data/destruction.json` (the three cans) are hollow shells welded to one another with their label as a skin. The items test area draws its items that way. `specFromObject3D` understands `userData.destructionSkin` (such a mesh stays on the part it overlaps and never becomes a part of its own) and `root.userData.destructionMass` (the real weight, split between the parts); `buildItem` passes the item's `weight` that way.

### Patch Changes

- 9d7e0c5: The can families (`drink_can`, `food_tin`) now carry a `tessellate` rule in `data/destruction.json` (`cylinder: { heightSegments, radialSegments }` and `box: { widthSegments, heightSegments, depthSegments }`): `buildItem({ destructible: true })` rebuilds every `CylinderGeometry` and `BoxGeometry` of those models with those segment counts, so a bullet dent finds vertices to push in (the drawn cans had 16 sides and one height segment, and a shot dented nothing). Plain (non destructible) items keep the cheap geometry; the budgets scenario allows the triangles the rule added.
- 285cf02: The real-size check of the items area measures a piece upright, so an item that a blast or a throw has turned is no longer reported oversized.
- c21c718: The `models` scenario of the items test area counts the catalog items that name a shipped model from the data instead of a fixed 23.
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
  - @adatechnology/game-fluids@0.3.1
  - @adatechnology/game-interactables@0.2.6
  - @adatechnology/game-items@0.1.6

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
