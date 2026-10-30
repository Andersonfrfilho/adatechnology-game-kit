---
'@adatechnology/game-terrain': minor
'@adatechnology/game-terrain-three': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-animals-three': patch
'@adatechnology/game-audio': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-crowd-three': patch
'@adatechnology/game-floorplan-three': patch
'@adatechnology/game-items-three': patch
'@adatechnology/game-player': patch
'@adatechnology/game-urban-three': patch
'@adatechnology/game-vegetation-three': patch
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-vfx-three': patch
'@adatechnology/game-weapons-three': patch
'@adatechnology/game-weather': patch
---

Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
