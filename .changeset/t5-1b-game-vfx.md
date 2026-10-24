---
'@adatechnology/game-vfx': minor
---

New package: renderer-free visual effects, a literal port of the Explosion Lab (T5.1b). `createVfx` with the layer compositor (`explosion`: flash and light, fireball that cools into smoke, own smoke, shock wave that pushes the smoke, dust, shrapnel and embers, glowing debris, scorch, crater with a deformable `GroundField`, mushroom, lingering fires), `fire`, `push`, `update` and `pools` for a renderer; seeded streams (`lehmer`, `lcg`, `streamFor`; `per_event` or `shared`), ordered pools that reuse their records, blast lights and fire lights, screen shake and flash with the Lab and Workshop decays, `LOD_GAME` and `LOD_LAB`, the game's area cap (6 in 4 s within 40 m, the extra ones at 0.3), `PROFILES`, `EVENT_BUDGET` and `estimateCost`, a schedule that runs due timers from the last added to the first, and side requests (`crater`, `blast_front`, `ignite`) for what the host does.
