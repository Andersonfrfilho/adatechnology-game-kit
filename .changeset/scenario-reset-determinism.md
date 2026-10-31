---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-terrain': patch
---

A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

- `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
- `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
- `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
- `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
- `game-terrain`: clearing the marks starts their numbering again.
