---
'@adatechnology/game-destruction': patch
'@adatechnology/game-destruction-three': patch
---

O vão de alvenaria que uma explosão derruba sai em tijolos e torrões de poucos tijolos, não em placas. Os pedaços eram juntados em no máximo 24 caixas por golpe (6 para o que cai), e um vão de 3 m virava placas de 0,6 a 1,2 m. Agora `clumpUnits` junta só tijolos inteiros, uma fiada e um tijolo de cada vez, até 96 torrões por golpe (24 para o que cai). O reboco que estava sobre eles sai em lascas de 2 cm de espessura das faces rebocadas. No desenho, o pedaço de material que esfarela (tijolo, bloco, concreto, reboco) tem cantos e arestas quebrados (`buildRubbleGeometry`), em vez de uma caixa cortada.
