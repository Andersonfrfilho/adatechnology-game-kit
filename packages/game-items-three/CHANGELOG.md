# @adatechnology/game-items-three

## 0.6.0

### Minor Changes

- 0c67a15: Cans open before they are eaten, and a holed or leaking can is no longer food.

  - `game-contracts`: `SealSpec` (what opens a closed container: `openWith` tools or `byHand`; `spoilsWhenBreached`), `sealOpener` and `sealBlock`, and `TestableItem.seal` (`ModuleItemSeal`, with `open` and `contents` to draw the item open and what is left in it). `ItemUseDef` keys take the `eat` action.
  - `game-items`: `ItemDef.seal`; `resolveUse` with `UseContext.seal` does not spend a sealed item that is still closed, holed through or leaking (`UseResult.blocked`).
  - `game-items-goods`: the `canned_food` kind opens with a can opener, a pocket knife or a knife; `canned_drink` and the sardines open by hand; both are spoiled by a hole or a leak. The kind's seal is on every item of the catalog.
  - `game-fluids`: the `eat` use (spoonfuls from an open tin); `drink(id, liters, { eaten })` takes the liquid packed with the food without the effects of drinking it.
  - `game-items-three`: `openItem` draws a model open (`data/opening.json`): the cut lid of a tin bent up with the food inside the rim, the peeled lid of the sardines, the mouth of a drink can; `setOpeningContents` empties it as it is eaten. The items area gives the tins `seal` and the `eat` use.
  - `game-test-room`: a use that empties a sealed item opens it first, by hand or with a tool of the seal within reach or in the loadout, and says what is missing; a holed or leaking item is refused for eating and drinking; eating logs what was eaten.

- b818f6a: A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

  A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.

- b8d2a17: Jars and bottles with a cap (honey, home preserves, cooking oil, water, sports drink, coconut water, cachaça, communion wine) and the energy drink can are opened by hand before eating or drinking. The new `screw_cap` opening takes off the part a model marks with `asLid` and shows the mouth under it.
- 7ca2f8e: A screw cap is turned off by the other hand before the first bite or sip, in first and third person. `twistStroke` (game-contracts) is the hand turning a part round in strokes, for any cap, tap or knob; `ModuleItemSeal.openUse` and `turn` let a module open its seal with a use; the `unscrew` use (game-fluids) turns during its `turn` keys and opens at its `open` key; `turnItem` (game-items-three) turns and lifts the cap a model marks with `asLid`; the body takes the other hand's grip from `AvatarItemUsePose.gripL`.

### Patch Changes

- 9e0aa58: An item carried in first person no longer lifts the elbow above the shoulder: `HandTargets.elbows` (`view`, the default, or `body`) says where the elbows go, and the first-person arms keep the elbow in the view only for `view`; the room's carried items ask for `body`, so a tin in the hand has its forearm coming from below (elbow bend 103° instead of 57°). While C crouches, an item's second use (empty a tin) is on Shift+F instead of C, and the HUD says so. The items area lays an opening tool beside each sealed tin (a can opener next to the beans), within reach when the tin is picked up.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-items@0.2.0
  - @adatechnology/game-fluids@0.4.0
  - @adatechnology/game-floorplan-three@0.8.0
  - @adatechnology/game-interactables@0.2.12

## 0.5.0

### Minor Changes

- 3df0096: Bottles, jugs, cartons and jerrycans join the destructible families with the liquid they hold (water, sports drink, coconut water, juice, milk, cachaça, wine, cooking oil, honey, preserves, fuel), so a hit leaks what is inside like the cans already do.

## 0.4.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-floorplan-three@0.7.0
  - @adatechnology/game-fluids@0.3.6
  - @adatechnology/game-interactables@0.2.11
  - @adatechnology/game-items@0.1.11

## 0.4.0

### Minor Changes

- f68acce: Cans dent where they are hit and are holed on the lid, the bottom and the rim as on the side. An item family can give its shell the real wall thickness (`rule.wall`: a drink can is 0.1 mm on the body and 0.25 mm on the ends, a food tin a bit more); `tagForDestruction` writes it as `userData.destructionThickness` and `specFromObject3D` uses it for the part, so a 9 mm goes through a lid even at a slant. With `tessellate.cylinder.capRings` (and `three` passed to `tagForDestruction`, as `buildItem` does) each cylinder of the model becomes one lathe with rings on its ends and rows as fine as its columns, and a model drawn as a lathe gets the same columns, so the lid and the bottom have vertices to dent. In the world a ductile sheet 0.5 mm thin or less folds deeper than a plate for the same blow (up to 4 times), on a patch no wider than 2.5 cm and never past near its middle, and the slit a blade cuts in it is pushed in around. A skin follows its shell past the degenerate triangles of a lathe. The liquid of an opaque container is not drawn through a narrow mouth (a can's tab) nor through the bullet holes drawn on it.

  The test room pushes what a round hits at the point of the drawn surface it meets, along that surface's inward normal (plus a share along it), with the momentum the round lost there: all of it when it stopped, through a thin shell only what the wall and the liquid inside took. A round on the right of a can pushes it away and to the left and spins it; before, it got the whole momentum of the round along the shot at the box the world sees.

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [31fc87d]
- Updated dependencies [3aec7f3]
- Updated dependencies [31fc87d]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-floorplan-three@0.6.0
  - @adatechnology/game-fluids@0.3.5
  - @adatechnology/game-interactables@0.2.10
  - @adatechnology/game-items@0.1.10

## 0.3.2

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-floorplan-three@0.5.0
  - @adatechnology/game-fluids@0.3.4
  - @adatechnology/game-interactables@0.2.9
  - @adatechnology/game-items@0.1.9

## 0.3.1

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-floorplan-three@0.4.2
  - @adatechnology/game-fluids@0.3.3
  - @adatechnology/game-interactables@0.2.8
  - @adatechnology/game-items@0.1.8

## 0.3.0

### Minor Changes

- df42f4b: The test areas use the pieces of the kit instead of boxes: the weapons counters are the buffet of the furniture catalogue, the shelves and the finds table of the items area are a workbench and a meeting table of the catalogue, the 1.80 m reference is a person the host gives (`person` of `createItemsTestModule`; `personSpecOf` of `game-characters-three` is exported for it), and the probe of the sound bench is what the host gives (`probe` of `createAudioTestModule`, a portable radio of the goods catalogue in the kit's room). Without `person` or `probe` the area draws none.

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-floorplan-three@0.4.1
  - @adatechnology/game-fluids@0.3.2
  - @adatechnology/game-interactables@0.2.7
  - @adatechnology/game-items@0.1.7

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
