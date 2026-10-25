---
"@adatechnology/game-contracts": minor
"@adatechnology/game-destruction": minor
"@adatechnology/game-characters": minor
---

An explosive part can carry `explodes.lethalRadius` (and a blast `Hit` its `lethalRadius`; the `explode` event repeats it). A character inside it takes the whole blast, between it and `radius` it takes at most `blast.injuryPoints` (default 15 per segment) falling off to nothing at `radius`, so it is hurt but not killed. Without `lethalRadius` the blast is the old one: points fall off over `radius`.
