---
'@adatechnology/game-interactables-household': minor
---

The 92 household items now come from `@adatechnology/game-items-goods` (new dependency): `src/data/items.json` and the `item.*` locale keys are gone from the package; `hh.items` and `hh.strings` serve the same ids from the goods catalog, `HOUSEHOLD_ITEM_IDS` is new, and `loot.json` is unchanged (every id still exists).

Breaking notes: `category` is now one of the 14 categories of `game-items` (`food`, `drink`, `medical`, `tools`...; `hygiene` became `medical`, `kitchen` `tools`...) and the old category is in `tags`. The team's values win where the delivery had them: 18 items changed weight (for example `rope` 0.4 to 1 kg, `juice_box` 1 to 0.2 kg) and 8 changed size (`rice` 10x20x6 to 17.1x25x7.1 cm, `water_bottle` 7x28x7 to 6.6x18.3x6.6 cm, `juice_box` 7x20x7 to 5.2x10x3.7 cm, `bandage`, `first_aid_kit`, `flashlight`, `batteries`, and `hammer`, now standing in the pose of the team's model at 15.9x33x4.7 cm). pt-BR names of the 38 merged items are the team's.
