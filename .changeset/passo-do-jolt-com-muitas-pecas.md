---
'@adatechnology/game-destruction-three': minor
---

Com o motor Jolt, as peças novas de um quadro entram no mundo de uma vez (`createBodies`: uma inserção na broadphase, ids na ordem da lista) e não uma a uma. Uma peça que dorme e sai do motor (some, é cortada pelo limite de peças vivas, é trocada) acorda o que dormia apoiado nela: antes, essas peças ficavam dormindo no ar. Uma peça acordada há um passo ou mais não precisa: o que se apoia nela está na mesma ilha, acordado. A que dormia no último passo do motor e foi acordada e removida no mesmo quadro precisa (o motor ainda não acordou o que estava em cima): também acorda. O passo em lote é medido como "sem regressão" (a queda de quadros acima de 5 ms está dentro do ruído).

`game-destruction-three`: `EnginePieces.prepare` cria os corpos novos em lote (`makeBodies`); `EnginePieces.remove` de uma peça dormindo (ou que dormia no último passo do motor) acorda os corpos numa caixa ao redor da peça (`wakeAround`, margem de 0,1 m). `clear` não acorda ninguém.
