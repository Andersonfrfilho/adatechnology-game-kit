---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
---

New part status `'collapsed'` (added to `PartStatus`). Every part that is reported in a `collapse` event and was not already broken, melted or ash gets `status: 'collapsed'` instead of staying `intact`/`damaged`; it is kept by `serialize`/`load`, cleared by `reset`, and the part becomes `broken` if it later fractures. `partStatus` locale tables gained `collapsed` (`desabado`). A collapsed part still exists as a piece, so code that treats `broken`, `melted` and `ashes` as lost needs no change; exhaustive switches over `PartStatus` need a new case.
