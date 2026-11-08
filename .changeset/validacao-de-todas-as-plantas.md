---
'@adatechnology/game-floorplan-structure': minor
---

`slabsOffSupport(spec, state?, { ledgers })`: as lajes e telhados que só se apoiam e ficaram com o centro fora do que ainda os carrega (laje apoiada numa borda só). Sem `state`, confere a construção como foi feita; com o estado do mundo, confere depois de um colapso. Saiu do teste residencial para o SDK, e o teste de todas as plantas (`game-floorplan-three/tests/all-plans.test.ts`) usa em cada planta, estado, seed e opção.
