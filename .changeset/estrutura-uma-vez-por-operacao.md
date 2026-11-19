---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': patch
---

A estrutura de um objeto é resolvida uma vez por operação (`hit`, `explode`, `update`), não uma vez por parte perdida ou junta aberta: na explosão de 4 MJ no sobrado, 174 chamadas de `solveStructure` viram 39 (é resolvida de novo só quando algo lê cargas ou tensões no meio da operação). Muda o contrato do `detach`: `groups` são os grupos do objeto depois da operação inteira, e todos os `detach` da operação saem no fim dela, na ordem em que as juntas abriram, depois dos outros eventos (o `collapse` inclusive). `DestructionWorld.structureProbe()` conta as resoluções. `game-destruction-three`: uma fratura solta primeiro os grupos que a operação deixou soltos e só então vê se o que sobrou do objeto perdeu o apoio, então a ordem do `detach` e da `fracture` não muda como as peças se separam. A garantia vale para o mundo do `createDestruction`; os outros `DestructibleImpl` (veículos de `game-vehicles`, personagens de `game-characters`, que manda só a peça que saiu, `[[segmento, ...caídos]]`) continuam emitindo um `detach` por junta com os grupos daquele momento.
