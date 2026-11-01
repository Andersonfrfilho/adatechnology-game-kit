# @adatechnology/game-items-goods

## 0.3.0

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

### Patch Changes

- b8d2a17: Jars and bottles with a cap (honey, home preserves, cooking oil, water, sports drink, coconut water, cachaça, communion wine) and the energy drink can are opened by hand before eating or drinking. The new `screw_cap` opening takes off the part a model marks with `asLid` and shows the mouth under it.
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
  - @adatechnology/game-items@0.2.0

## 0.2.5

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-items@0.1.11

## 0.2.4

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-items@0.1.10

## 0.2.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-items@0.1.9

## 0.2.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-items@0.1.8

## 0.2.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-items@0.1.7

## 0.2.0

### Minor Changes

- 1af2cb3: Every item of the catalog declares a `kind` from a tree (`kinds.json`, 41 kinds: consumable, container, weapon, wearable, equipment, material_misc and their children) that supplies defaults (parts and materials, impact, use animation and sounds, leftover, raw effect) and the contracts the item must meet. New: `GOODS_KINDS`, `createGoodsKinds`, `checkGoodsItems`, `createItemContracts`, `ITEM_CONTRACTS`, `GOODS_KNOWN_GAPS` and the `kind.<id>` texts in pt-BR and en. Values filled from the real world carry `estimated: [...]`; `pnpm check:items` fails when an item lacks what its kind requires. Seven impossible densities fixed.
- c21c718: 222 more items now carry `model: <id>`, pointing to the kit-authored model of `@adatechnology/game-items-three` that draws them (245 items in all). Sizes are unchanged: the models were authored at the catalog size.

### Patch Changes

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
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-items@0.1.6

## 0.1.5

### Patch Changes

- @adatechnology/game-items@0.1.5

## 0.1.4

### Patch Changes

- @adatechnology/game-items@0.1.4

## 0.1.3

### Patch Changes

- @adatechnology/game-items@0.1.3

## 0.1.2

### Patch Changes

- @adatechnology/game-items@0.1.2

## 0.1.1

### Patch Changes

- @adatechnology/game-items@0.1.1

## 0.1.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- 682554f: New package: the real-world item catalog for `game-items`. 327 items with real size and weight, 17 categories, 24 places, 17 containers, recipes, use effects, house pools, depletion and spawn tables, ammo boxes, provenance and pt-BR (the team's names) and en texts. Generated by `tools/items-catalog`; `createGoodsItems()` and `goodsPack` plug it into `createItems`.

### Patch Changes

- Updated dependencies [6314632]
- Updated dependencies [3bf868b]
- Updated dependencies [e48ea53]
- Updated dependencies [8d2caad]
  - @adatechnology/game-items@0.1.0
