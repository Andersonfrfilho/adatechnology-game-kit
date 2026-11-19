---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-destruction-three': patch
---

Peças paradas dormem também no motor Jolt pela mesma regra do solver do kit (`piece-rest`: paradas 0,5 s abaixo de 12 cm/s, ou no mesmo lugar por 1,5 s), nunca enquanto o empurrão de equilíbrio (`topple`) ainda age nelas. Peças que se tocam dormem juntas, só quando tudo o que tocam acordado também vai dormir: postas para dormir uma a uma, uma acordava a outra para sempre. Novo `PhysicsWorld.touchingBodies(id, out)`: os corpos que um corpo tocou no último passo. As constantes de repouso, de inclinação mantida e `turnBetween` deixam de existir em dobro (`pieces.ts` e `engine-pieces.ts` importam de `piece-rest.ts`).
