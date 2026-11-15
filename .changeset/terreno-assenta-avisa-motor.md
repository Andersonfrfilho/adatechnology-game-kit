---
'@adatechnology/game-terrain': patch
---

O terreno que assenta avisa o motor: o entulho que pousa sobe o chão (2 a 8 cm, a 5 a 13 m do evento) sem emitir `onDeform`, e os ladrilhos de chão do motor físico ficavam até 80 mm abaixo do chão desenhado, com o que dormia em cima enterrado. Agora cada atualização que assenta entulho emite um único `onDeform` com a região dos vértices que subiram (nunca um por vértice). `fill` também avisa de onde tirou a terra, e `reset`, `setLayout` e `load` avisam que o chão inteiro mudou.
