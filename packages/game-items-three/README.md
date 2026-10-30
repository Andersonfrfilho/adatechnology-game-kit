# @adatechnology/game-items-three

three.js presentation for `@adatechnology/game-items`. Everything is drawn at the **real size** of the item (metres, y up, origin at the bottom centre).

- **Models of the team:** the 24 builders of the Itens do Vale Cinzento showcase, ported as they are (their units, their materials by tag) and scaled to metres by the `scale` of its entry. A game adds or replaces one with `registerItemModel`.
- **Simple shapes:** 25 shapes (`can`, `bottle`, `box`, `bag`, `tool`, `blade`, `long_tool`, `garment`, `backpack`, `jerrycan`, `tank`, `book`, `key`, `battery`, `plank`, `device`...) drawn inside the `size` of any item, chosen by its `shape` hint refined by category and proportions (`shapeOf`).
- **Wear:** `setWear(object, 0 | 1 | 2)` takes the materials from new to used to spoiled, as the showcase does.
- **Opened cans:** `openItem(THREE, root, modelId)` draws a sealed model open (`data/opening.json`): a tin's cut lid bent up with the food inside the rim, the sardines' peeled lid, the mouth of a drink can; `setOpeningContents(root, share)` empties it as it is eaten. The items area gives each sealed item (`ItemDef.seal`) the room's `seal` and the `eat` use.
- **Budgets:** `mergeItem` joins an item by material, `buildItemLod` gives three levels (model or shape, half-detail shape, nothing past 30 m for a small item and 60 m for a large one), `ITEM_BUDGETS` and `checkBudget` hold the page's 30 draw calls and 400 / 1200 triangles.

```ts
import * as THREE from 'three'
import { createGoodsItems } from '@adatechnology/game-items-goods'
import { buildItem, buildItemLod, setWear } from '@adatechnology/game-items-three'

const items = createGoodsItems()
const can = buildItem(THREE, items.get('canned_beans'))   // model or shape, real size
scene.add(can.root)
setWear(can.root, 2)                                      // spoiled
scene.add(buildItemLod(THREE, items.get('hammer')).root)  // merged, with LOD and cull
```

three.js is a peer dependency (`^0.160`). The global of the IIFE build is `GameItemsThree`.

The geometry comes from [`game-shapes`](../game-shapes): the kit's `T` is `shapeGeometries(THREE)`, so the ported builders keep writing
`new T.CylinderGeometry(...)` and get the same bytes from game-shapes' template cache (a tube still comes from three), and `mergeItem` joins on
`game-shapes-three`. `tests/exact-golden.test.ts` holds every bit of the 24 models and 25 shapes (alone, merged, half detail, LOD) as the old
path made them.
