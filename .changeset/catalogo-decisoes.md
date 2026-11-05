---
'@adatechnology/game-weapons': patch
---

The `pdw` tags of the FN P90 and the HK MP7A1 and the break-action model of the M79 are decisions of the catalogue (`weaponTags` and `weaponModels` in `tools/weapons-catalog/decisions.json`), so the generated `firearms.json` and `models.json` keep them: they had been written into the generated files by hand, and the catalogue check failed.
