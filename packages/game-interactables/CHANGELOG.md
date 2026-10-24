# @adatechnology/game-interactables

## 0.2.5

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.2.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.2.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.2.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.2.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.2.0

### Minor Changes

- cc182c7: Contracts: `Thumbnail` (`svg` or `render`, with `yaw`, `pitch`, `distance` and `wear`) and `TestableItem.thumbnail`; the registry helpers `mergeById`, `applyPatches`, `removeIds`, `deepMerge` and the `DeepPartial` type now live here so every catalog package merges packs the same way. Interactables: `ItemDef.thumbnail` and a dependency on the contracts. Weapons: imports the helpers from the contracts (public API unchanged).

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.1.0

### Minor Changes

- 5ad2b1a: Initial release (0.1.0): renderer-agnostic runtime for interactive world objects (movable parts with swept-area fitting, containers and deterministic loot, power grid, fuel, logical water network, seats, soft volumes, emitters, mirrors, colliders, damage, save/load) with an `en` / `pt-BR` locale table.
