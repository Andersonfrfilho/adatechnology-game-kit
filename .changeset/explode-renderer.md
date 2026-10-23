---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

`DestructionRenderer.explode(point, energy, radius)` draws a blast that has no exploding part (flash, fire, smoke, light, sound and a shove on pieces in range). `world.explode` emits no event, so a grenade used to leave only debris; the test room now calls the new method when a thrown explosive detonates.

`explode` is a new **required** member of the `DestructionRenderer` interface: any implementer of the interface (a custom renderer, a test double) must add it.
