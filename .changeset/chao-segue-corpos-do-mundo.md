---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-destruction-three': minor
---

feat(physics): `SeamWorld.readAwakeBounds` lista os corpos dinâmicos acordados e os personagens (caixa e velocidade horizontal); o chão do motor (`game-destruction-three`, `engine-ground-follow.ts`) segue todo corpo que não é das peças: ladrilho que falta embaixo é feito na hora, o da frente vai ao worker, e o ladrilho que ninguém pediu há 600 atualizações e sem corpo em cima sai do mundo.
