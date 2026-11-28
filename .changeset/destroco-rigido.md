---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': patch
'@adatechnology/game-destruction-three': minor
---

O destroço grande de uma quebra (20 cm ou mais, e as barras de uma armadura) passa a ser movido por um corpo rígido do motor, na camada nova `rubble`, que
encontra o mundo fixo e outro `rubble` e mais nada. A tábua quebrada cai, apoia e deita como toda peça; a física leve do `FragmentSystem` fica só com a lasca.
O pedaço que nasce dentro de um sólido fixo ou encostado no pedaço ao lado atravessa aquilo até sair. `DestructionRenderer.pieces()` não devolve esses corpos.
`FragmentSystemOptions.rigid` (`RigidDebris`) é a porta; sem ela o `FragmentSystem` se comporta como antes.
