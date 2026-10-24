# @adatechnology/game-interactables-household

## 0.2.1

### Patch Changes

- @adatechnology/game-interactables@0.2.1
- @adatechnology/game-items-goods@0.1.1

## 0.2.0

### Minor Changes

- 5c9f47a: The 92 household items now come from `@adatechnology/game-items-goods` (new dependency): `src/data/items.json` and the `item.*` locale keys are gone from the package; `hh.items` and `hh.strings` serve the same ids from the goods catalog, `HOUSEHOLD_ITEM_IDS` is new, and `loot.json` is unchanged (every id still exists).

  Breaking notes: `category` is now one of the 14 categories of `game-items` (`food`, `drink`, `medical`, `tools`...; `hygiene` became `medical`, `kitchen` `tools`...) and the old category is in `tags`. The team's values win where the delivery had them: 18 items changed weight (for example `rope` 0.4 to 1 kg, `juice_box` 1 to 0.2 kg) and 8 changed size (`rice` 10x20x6 to 17.1x25x7.1 cm, `water_bottle` 7x28x7 to 6.6x18.3x6.6 cm, `juice_box` 7x20x7 to 5.2x10x3.7 cm, `bandage`, `first_aid_kit`, `flashlight`, `batteries`, and `hammer`, now standing in the pose of the team's model at 15.9x33x4.7 cm). pt-BR names of the 38 merged items are the team's.

### Patch Changes

- Updated dependencies [6314632]
- Updated dependencies [50eee43]
- Updated dependencies [682554f]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
  - @adatechnology/game-items-goods@0.1.0
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables@0.2.0

## 0.1.0

### Minor Changes

- 8ab1f1e: Initial release (0.1.0): household content pack for `@adatechnology/game-interactables` with 37 modeled objects (storage with real depth and drawers, kitchen and bathroom fixtures, electrical items, seating, windows, yard objects), 90 items, loot tables, `en` / `pt-BR` strings and `br` / `us` region data.
- d99d915: Twelve new types for rural homes and camping: `bunk_bed`, `wood_stove`, `fireplace` (brick or stone), `outhouse`, `well` (bucket, crank and rope parts, a `hose` fixture on a 20 000 l tank), `cooler` (loot table `cooler`), `campfire`, `camp_stove`, `gas_canister`, `lantern_lamp`, `camp_chair` and `camp_table`. New `rural` and `camp` groups, `item.flueHeight` / `item.chimneyHeight`, region data `canister`, items `ice_pack` and `sandwich`, locale keys in `en` and `pt-BR`, destruction tags on every body and part.

  Adds `service_entrance` `variant: 'gato'`: an illegal tap with a bare drop wire and no pole, riser or meter box.

### Patch Changes

- Updated dependencies [5ad2b1a]
  - @adatechnology/game-interactables@0.1.0
