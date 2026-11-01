---
'@adatechnology/game-items-three': minor
---

Item models by instance (spec 005, D5): `createItemModels({ packs, patch, remove })` returns a set (`has`, `entry`, `builder`, `list`, `register`, `unregister`, `build`) that starts from the shipped models and shares nothing with any other set; `buildItem` takes it through the new `models` option. `defaultItemModels()` is the registry behind `registerItemModel`, `unregisterItemModel`, `hasItemModel`, `itemModelEntry`, `itemModelBuilder` and `listItemModels`, which stay exported and `@deprecated` with the same results.
