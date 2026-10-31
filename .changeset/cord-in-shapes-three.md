---
'@adatechnology/game-shapes-three': minor
'@adatechnology/game-interactables-three': minor
---

`createCord` and `catenary` move to `@adatechnology/game-shapes-three` (spec 005, D1), so the weapons no longer reach into `game-interactables-three` for them. `game-interactables-three` keeps both exports, `@deprecated`, delegating to the new ones; they are removed in the next major.
