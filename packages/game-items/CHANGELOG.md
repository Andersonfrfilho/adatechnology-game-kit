# @adatechnology/game-items

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-interactables@0.2.4

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-interactables@0.2.3

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-interactables@0.2.2

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-interactables@0.2.1

## 0.1.0

### Minor Changes

- 6314632: The finds of the floorplan come from the item catalog. `FloorplanOptions` takes `day` and `region` and the contents extension passes them (with `place`, `footprint` and `key`) in the query; `FindsProvider.findsFor` may return `null` ("not mine") and an empty array is now an answer, with `engine.findsAnswer` for packs that have their own default. `game-items`: `createFindsProvider` takes `placeAliases`, `poolPlaces` and `unknownContainers: 'pass'`. `game-items-goods`: `createGoodsFindsProvider(catalog)` for `engine.registerFindsProvider`, with the furniture categories of the floorplan packs bound to the house pools of the visor.
- 3bf868b: New package: the item catalog engine (skeleton). `ItemDef` (category, real size, weight, rarity, durability, shelf life, nutrition, protection, carry, weapon link, finds), `createItems({ packs, patch, remove, include, categories, places, containers, rules })` over the shared registry helpers, `ITEM_CATEGORIES` (14) and `DEFAULT_RULES` (rarity weights, freshness, storage, carry, protection, retail spawn). No content and no logic yet.
- e48ea53: `BodySlot` comes from `game-contracts` (adds `over`, a layer worn over the others) and `ItemDef.protection.ballistic` (`resistance`, `blunt`, `pass`, `consumable`) is the protection game-characters reads against projectiles.

### Patch Changes

- 8d2caad: `DEFAULT_RULES.rarity.fixedOnly` now lists `legendary` as well as `unique`: the team's page says neither is ever rolled ("Lendário e único nunca são sorteados"). The weights stay those of the team's table.
- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-interactables@0.2.0
