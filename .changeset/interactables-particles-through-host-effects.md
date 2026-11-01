---
'@adatechnology/game-interactables-three': minor
---

`EffectsOptions.effects` (spec 005, A9): a function returning the host's effects world. With one, smoke, steam, fire and spark particles are played through it (`particle_puff`, `particle_glow`, `particle_streak`) with the colour, opacity, life and sizes the local pool would have given them, and `maxParticles` no longer caps them. Water stays in the local pool. Without one the pools are used as before, with a one-time warning (deprecated).
