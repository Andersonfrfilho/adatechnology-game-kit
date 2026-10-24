---
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': patch
---

Chain reaction of explosives (A11). A part with `explodes.chain` is set off by a bullet, fire or a blast within reach and explodes after the delay of that trigger (fixed or drawn from the seed); the world emits `primed` and then `explode`, a part goes off once, blasts resolve in order of time and the delays count from the blast that armed the part, so the timeline does not depend on the `dt` of `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `game-weapons` (fuel barrel, car tank, propane, pump, station tank). A bullet or a blast that would have destroyed such a part now arms it instead. `game-destruction-three` draws the fire of a part primed by a shot or fire.
