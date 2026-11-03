---
'@adatechnology/game-characters-three': patch
---

The survivor and Bestiário builders are typed (no `@ts-nocheck`): `PersonSpec`, `PersonCharacter`, `BestSpec`, `BestPose` and the rigs are exported, `PersonBuilder.build` returns a `PersonCharacter` and `BestBuilder.build` a `THREE.Group`. A clothing entry without a colour now takes the top's material instead of none.
