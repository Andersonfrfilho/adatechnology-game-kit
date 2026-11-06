---
'@adatechnology/game-items-goods': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-weapons-three': minor
---

The KA-BAR (uncommon), the katana (rare) and the brass knuckles (rare) are items of the goods catalog and turn up in the house loot: the KA-BAR in dressers, nightstands, filing cabinets, workbenches and tool shelves (drawers and garage), the katana in the china cabinet and the wardrobe, the brass knuckles in dressers, nightstands and the wardrobe. Each is the same object as its weapon (`weapon` and `model` of the same id) and `game-weapons-three` draws the weapon with the item model of `game-items-three`, so the model exists once. The pool share of an entry is 2 x the share of its rarity in the rarity table, with its reason in `tools/items-catalog/decisions.json` (`housePoolExtras`).
