---
'@adatechnology/game-kit-defaults': major
---

`physics: 'own'` saiu de `createKitWorld`/`createKitWorldSync` (`PhysicsChoice`, `GivenPhysicsChoice`, `KitWorldPhysics.pieces` e `info.kind`). Migração: o padrão segue `'jolt'`; para um motor do jogo passe um `PhysicsLoop` (ou um `SeamWorld` que o jogo passa o passo). `createKitWorldSync` sempre exige um `PhysicsLoop` ou `SeamWorld`.
