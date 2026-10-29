---
'@adatechnology/game-contracts': minor
---

Add the category engine: `defineCategories` (inheritance of any depth, `defaults`, `requires`, `abstract`; games add, patch, insert parents and remove through `extra`, `patches` and `remove`), `resolveEntry` and `checkCategorized` with `ContractChecker` and an `allow` list for known gaps.
