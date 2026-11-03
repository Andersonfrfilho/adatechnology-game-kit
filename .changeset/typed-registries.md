---
'@adatechnology/game-devtools': patch
'@adatechnology/game-shapes': patch
'@adatechnology/game-urban': patch
'@adatechnology/game-vegetation': patch
'@adatechnology/game-shapes-three': patch
---

No `any` in the public types: `ShapeGenerator<TParams>`, `Composer<TParams>` and `PoleShapeBuilder<TSpec>` take the params type of the entry (a registry still holds entries with different params), and `Devtools.db` is a typed `MarksDatabase`.
