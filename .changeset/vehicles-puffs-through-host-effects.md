---
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vehicles-three': minor
---

`VehicleKitOptions.effects` (spec 005, A9): a function returning the host's effects world. With one, smoke, fire and dust puffs are played through it (`particle_puff`, `particle_glow`) with the colour, opacity, life and size the local puff would have had, and the kit's own cap (400) does not apply to them. Without one the kit draws its own sprites as before, with a one-time warning (deprecated). Solid debris (sparks, shards, scrap) stays local. The vehicles test area passes `host.effects`.
