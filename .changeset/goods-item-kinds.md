---
"@adatechnology/game-items-goods": minor
---

Every item of the catalog declares a `kind` from a tree (`kinds.json`, 41 kinds: consumable, container, weapon, wearable, equipment, material_misc and their children) that supplies defaults (parts and materials, impact, use animation and sounds, leftover, raw effect) and the contracts the item must meet. New: `GOODS_KINDS`, `createGoodsKinds`, `checkGoodsItems`, `createItemContracts`, `ITEM_CONTRACTS`, `GOODS_KNOWN_GAPS` and the `kind.<id>` texts in pt-BR and en. Values filled from the real world carry `estimated: [...]`; `pnpm check:items` fails when an item lacks what its kind requires. Seven impossible densities fixed.
