---
'@adatechnology/game-items-goods': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-weapons-three': minor
---

The KA-BAR (uncommon), the katana (rare) and the brass knuckles (rare) are items of the goods catalog and turn up in the house loot: the KA-BAR in dressers, nightstands, the workbench and the tool shelf (drawers and garage), the katana in the wardrobe, the brass knuckles in dressers, nightstands and the wardrobe. Each is the same object as its weapon (`weapon` and `model` of the same id) and `game-weapons-three` draws the weapon with the item model of `game-items-three`, so the model exists once. The pool weight of an entry is small (0.06 uncommon, 0.03 rare, against 2 for a common entry) and only pools of six entries or more carry one, so each turns up in a few containers in a hundred; the reason in `tools/items-catalog/decisions.json` (`housePoolExtras`).
