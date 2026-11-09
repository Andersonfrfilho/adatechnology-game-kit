---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-render-three': minor
'@adatechnology/game-test-room': patch
---

Destroço parado pode custar pouco (opcional: sem as opções nada muda). Orçamento de corpos acordados: acima de `maxAwakePieces` peças soltas (sugerido `SUGGESTED_MAX_AWAKE_PIECES`, 24), as mais antigas que já pararam (no chão, mais lentas que o limite de repouso, e a que está escorada só depois de manter a inclinação por 1,5 s) dormem onde estão, sem teletransporte; acima de `maxAwakeFragments` (sugerido 64) o mesmo vale para os fragmentos. A peça posta para dormir pelo orçamento guarda os pontos em que se apoiava e acorda quando qualquer um deles perde o apoio: a tábua escorada num degrau que sumiu cai, mesmo com o pé ainda no chão. Com `settledBatches` o destroço em repouso é desenhado em lote, um desenho por material (`createStaticBatcher` do `game-render-three`, que ganhou `materialKey` para juntar cópias iguais de um material): a colisão continua a de cada peça, e a peça atingida, acordada, amassada, escondida ou com qualquer evento volta a ser desenhada sozinha na hora. `settledBatchStats()` diz quantos lotes e quantas malhas. A sala de teste liga o desenho em lote; o orçamento fica desligado nela até decisão do dono (`debris.maxAwakePieces`/`maxAwakeFragments` ligam).
