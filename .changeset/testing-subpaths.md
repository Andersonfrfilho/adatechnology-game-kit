---
'@adatechnology/game-animals-three': minor
'@adatechnology/game-audio': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-crowd-three': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-player': minor
'@adatechnology/game-stories': minor
'@adatechnology/game-terrain-three': minor
'@adatechnology/game-urban-three': minor
'@adatechnology/game-vegetation-three': minor
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-weather': minor
'@adatechnology/game-weather-three': minor
---

New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.
