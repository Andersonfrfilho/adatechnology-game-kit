---
'@adatechnology/game-weapons-three': minor
---

Granada M67 como desenhada e cápsulas no motor físico (spec 008, T4.3). `game-weapons-three` ganha `explosiveCollider` (corpo, espoleta e alavanca, lidos das mesmas medidas do desenho em `M67_PARTS`), `casingCollider`, `spawnLoose`, `syncLoose`, `dropLoose` e a opção `physics` em `createWeaponFx`: com um mundo do `game-physics`, as cápsulas ejetadas pelos modelos da galeria viram corpos dele (C_rr 0,015, varridos, dormem sozinhos). Sem a opção, o salto próprio da galeria continua.
