---
"@adatechnology/game-test-room": minor
"@adatechnology/game-weapons-three": minor
---

A granada de mão e as cápsulas da sala são corpos do motor (TS.5): `ProjectileModel.body` (o colisor do modelo desenhado) faz a sala lançar a granada no mundo físico, varrida e girando, e só contar o estopim; sem laço físico a sala voa a granada como antes. `WeaponFx.clearLoose()` tira cápsulas, carregadores e fumaça do mundo e da cena, e a área de armas o chama no `onClear` da sala.
