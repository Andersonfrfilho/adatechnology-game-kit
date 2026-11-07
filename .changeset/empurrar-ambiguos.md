---
'@adatechnology/game-player': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-fluids': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-test-room': minor
---

Pushing, as in the real world. A pushed piece that meets a loose one shoves it along when the legs beat the frictions of the whole row (`canPush`, `pushSpeedFor` and `pushAccelerationFor` take a row; `FurniturePush.setLoad`), and locks when they do not. Dragging scratches the floor by its material (`dragMarks` in `FurniturePushRules`, `dragMarkFor`): wood and tile scratch, concrete scuffs, dirt and sand furrow, carpet and grass keep no mark; the scratch is a persistent `scrape` mark of `game-vfx` (`VfxWorld.scrape`, at most `SCRAPE_LIMIT`, the oldest leaving first), drawn instanced by `game-vfx-three`. Civilians walk round a piece of furniture along its face instead of shoving it (`crowd.movableAt`, `bodyRadius`), and `flee` starts its own stuck count. A liquid spilled on a table top goes with the pushed table (`FluidWorld.moveSurface`). `world.sweepBox` ignores a list of objects.
