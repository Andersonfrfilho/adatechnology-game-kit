---
'@adatechnology/game-destruction-three': minor
---

Com o motor Jolt, as peças novas de um quadro entram no mundo de uma vez (`createBodies`: uma inserção na broadphase, ids na ordem da lista) e não uma a uma. Uma peça que dorme e sai do motor (some, é cortada pelo limite de peças vivas, é trocada) acorda o que dormia apoiado nela: antes, essas peças ficavam dormindo no ar. Uma peça acordada não precisa: o que se apoia nela está na mesma ilha, acordado.

`game-destruction-three`: `EnginePieces.prepare` cria os corpos novos em lote (`makeBodies`); `EnginePieces.remove` de uma peça dormindo acorda os corpos numa caixa ao redor da peça (`wakeAround`, margem de 0,1 m). `clear` não acorda ninguém.
