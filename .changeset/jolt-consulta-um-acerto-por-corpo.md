---
'@adatechnology/game-physics-jolt': patch
---

As consultas do mundo Jolt (`overlapSphere`, `overlapShape`, `contactBodies`, `penetration`, `sphereCastAll`) deixam de guardar um resultado por triângulo no heap do wasm: um coletor de JS entrega cada acerto e fica com um por corpo (o mais próximo, no `sphereCastAll`). Antes, uma esfera de 12 m sobre o campo de alturas do chão retinha ~18 MB por mundo e o lançador na área de terreno abortava com `Aborted(OOM)`. As matrizes de posição das consultas passam a ser liberadas.
