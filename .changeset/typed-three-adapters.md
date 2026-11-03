---
'@adatechnology/game-interactables-three': patch
'@adatechnology/game-vegetation-three': patch
'@adatechnology/game-urban-three': patch
---

No `any` in the three.js adapters of interactables, vegetation and urban: they take three's own types (`typeof THREE`, `Object3D`, `IUniform`, `HTMLCanvasElement`). New exported types: `SwayMaterial` and `UrbanLight`.
