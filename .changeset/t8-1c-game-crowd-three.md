---
'@adatechnology/game-crowd-three': minor
---

New package (spec 001, T8.1c): the three.js drawing of a `game-crowd` crowd, a literal port of the team game's `hordeRender` and `npcRender`.
`createCrowdInstances` (view culling, LOD 18/55 m with 1.5 m of hysteresis, the attack pose in at 1.6 m and out at 2.2 m, the pose by state, the
bloater's swelling, bodies on the ground that darken and shrink, civilians), `createCrowdRenderer` on the baked variants of `game-characters-three`
(a type is baked the first time it is drawn), `createHerdView` for the herd on the animals' own rigs, `CROWD_SOUND_BANK` (the scream, the groans and
the animal calls) and `createCrowdTestModule` (`crowd_area`). The golden `game-crowd-render.json` replays the game's drawing instance by instance.
