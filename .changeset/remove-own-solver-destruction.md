---
'@adatechnology/game-destruction-three': major
---

O solver próprio das peças soltas saiu: `physics: 'own'` não existe mais e `PiecePhysics` é `PhysicsLoop | SeamWorld`. Migração: passe um `PhysicsLoop` (`createPhysicsLoop(world)` sobre um mundo do `game-physics-jolt`) em `physics`; sem `physics` o renderer lança `PhysicsOptionError`. `jitWarmUp` sem `engine` não aquece nada. `PieceSystem.contactHits` nunca devolve `null`; `stepCost()` nunca devolve `null`.
