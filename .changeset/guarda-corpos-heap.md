---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': patch
---

`createBody` e `createBodies` lançam `BodyLimitError` (código `BODY_LIMIT_REACHED`) quando o mundo está no teto de corpos, em vez de seguir com um corpo nulo. O contrato ganha `bodyCapacity` e `memoryTotal()` para o host ler a ocupação (corpos vivos contra o teto, bytes livres do heap) sem custo por quadro.
