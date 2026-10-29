---
'@adatechnology/game-destruction': minor
'@adatechnology/game-floorplan-three': minor
---

Structure: a slab or beam is held by the sum of its supports (documented and tested: four columns share the load, each loss moves it to the rest, the
slab falls when the capacity left is less than the load). New world option `structure: { safetyFactor }` (default 1) multiplies every load before it
meets the capacities. `game-floorplan-three`: `SpecimenDef.sizing` (`safety`, `redundancy`, `safetyOthers`) sizes a specimen; the frame house of the
area (`house_casa_portico`) is sized at 0.72 / 0.97 (four pillars: one lost 0.96, two lost fall), so `house_two_pillars` passes with the team's own
sequence (two pillars) in the real room, and the extended hit sequence the module used as a workaround is gone.
