---
'@adatechnology/game-destruction': minor
---

The grenade correction is always on: `breach.blastReach` is removed (breaking, it was off by default). A blast opens a breach only within 0.12 m per
cube root of kilojoule of the part (`BREACH_BLAST_REACH`), with no flag and no second path. The `gas_explodes` scenario of the `house-scenarios` golden was
regenerated: the window, 2.3 m from the gas bottle (60 kJ reach 0.47 m), no longer shatters on the blast (the breach does not reach it).
