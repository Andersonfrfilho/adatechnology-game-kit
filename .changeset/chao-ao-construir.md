---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

O chão do motor é montado quando a área é construída, e não no quadro em que as peças dela acordam (decisão D8 da spec 008). Nenhuma regra muda: não há limite de ladrilhos por quadro.

`game-destruction-three`: `DestructionRenderer.prelayGround(bounds)` (e `GroundBounds`) assenta os ladrilhos de chão do motor sob o retângulo da área mais uma margem (`margin`, padrão 4 m, no máximo 2500 ladrilhos por chamada) e devolve quantos fez. O chão fora da área continua sendo assentado quando uma peça chega (inclusive ao longo do caminho de uma peça rápida), um ladrilho cavado continua sendo refeito por `wakeRegion`, e `release`/reset remove todos os corpos (§8). No solver próprio não há corpos de chão: devolve 0.

`game-test-room`: `layArea` chama `prelayGround` com a caixa do que acabou de montar.
