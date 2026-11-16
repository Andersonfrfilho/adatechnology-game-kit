---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

`jitWarmUp` (ligado por padrão): o primeiro `createDestructionRenderer` roda uma explosão numa parede pequena fora da tela, num mundo e num renderizador próprios, tudo liberado, uma vez por motor. A primeira explosão do jogo deixa de custar o dobro: o primeiro segundo de física cai 14% na explosão e 12% no martelo da sala, por 0,37 s a mais no carregamento. `false` desliga; `{ engine }` aquece também os caminhos do motor. `warmUpDestructionJit` é exportado. `game-shapes-three` passa a dependência de `game-destruction-three`. Na sala de teste: `debris.jitWarmUp` e `?warmup=0`.
