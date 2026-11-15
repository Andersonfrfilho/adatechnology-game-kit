---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

Com o motor Jolt, uma peça solta de várias partes (um poste com os fios) pode assentar o chão só sob a caixa de cada parte, e não sob a caixa de todas juntas. Desligado por padrão: o chão assentado é o mesmo de antes.

`game-destruction-three`: `RendererOptions.tilesUnderParts` (e `PieceSystemOptions.tilesUnderParts`). Ligado, `EnginePieces.layGround` assenta os ladrilhos sob cada caixa de parte (`partBoxes`, com a mesma margem de 0,5 m, a mesma oscilação e os mesmos pontos do caminho). Uma peça de 23 m de largura feita de 26 partes finas assentava 72 ladrilhos (e o sólido de cada um); com a opção, assenta os que tem partes sob ou perto. Medido na sala: p99 do quadro do blast de 91 para 78 ms e máximo de 206 para 178 ms (T3.8v). Fica desligado porque, nas rodadas do blast, o poste que ganha energia (C1 acima de 5 kg·m) apareceu em 8 de 25 rodadas com a opção contra 2 de 25 sem ela; o dono decide.

`game-test-room`: `debris.tilesUnderParts`, e `?tilesUnderParts=1` na página da sala.
