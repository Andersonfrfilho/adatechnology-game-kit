---
'@adatechnology/game-vfx': minor
---

`particle_puff`, `particle_glow` and `particle_streak` (spec 005, A9): one sprite per play, every number from `EffectRequest.values` (`vx`, `vy`, `vz`, `life`, `size`, `grow`, `color`, `alpha`, `gravity`, `drag`). The adapters that had particle systems of their own hand their particles to the effects world through them, so the effects world's budget is the only one.
