---
'@adatechnology/game-interactables': minor
---

Juntas do motor físico nos interativos (spec 008, T4.4). `WorldOptions.partPhysics` aceita um motor (`createEnginePartPhysics(world)`, sobre `@adatechnology/game-physics`): porta e tampa em dobradiça com limite, gaveta em corrediça, cortina e pano em correntes de juntas swing-twist, e porta que quebra por impulso (evento `broke`, `EnginePartOptions.breakImpulse`). `t` passa a ser lido da junta; o `PartSpec.bounds` é a folha. `buildChain` e `chainPoints` servem para um cabo. Sem a opção, ou em parte sem `bounds`, nada muda: o mundo anda o `t` na velocidade do movimento.
