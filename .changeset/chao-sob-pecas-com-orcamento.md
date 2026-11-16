---
'@adatechnology/game-terrain': minor
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

O chão que o motor põe sob as peças custa menos, sem mudar o chão nem o que as peças fazem sobre ele.

`game-terrain`: `Terrain.heightRange(minX, maxX, minZ, maxZ)` devolve os limites exatos da altura do terreno sobre um retângulo, lidos nos vértices que ele cobre (a altura entre vértices é uma mistura dos quatro ao redor), ou `null` quando o retângulo sai do terreno.

`game-destruction-three`: com `terrainRangeAt` (opção do renderizador e do sistema de peças), um ladrilho que o terreno prova plano é assentado como laje sem ler as 25 921 amostras; qualquer relevo sob ele, uma cratera de um vértice inclusive, faz a leitura inteira como antes. `blastGroundTiles` (padrão 0, desligado: medido, 48 ladrilhos moveram cerca de 24 ms para o quadro da explosão e não melhoraram o pior quadro) assenta, na explosão, essa quantidade de ladrilhos ao alcance dela, os mais próximos primeiro, antes de as peças que ela solta precisarem deles. O sólido sob uma cratera refeito por uma mudança do chão reaproveita os cascos que a mudança não tocou.

`game-physics`, `game-physics-jolt`: `ShapeDesc` composto aceita `reuseHulls`; o corpo guarda os cascos convexos da forma atual e a próxima forma dele pega os que são iguais bit a bit, em vez de montá-los de novo. Guarda só os cascos da forma atual, então a memória não cresce com as mudanças.

`game-test-room`: a sala passa o `terrainRangeAt` do terreno dela.
