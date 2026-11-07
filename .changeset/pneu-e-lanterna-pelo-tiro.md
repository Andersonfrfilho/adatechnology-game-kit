---
'@adatechnology/game-vehicles': patch
'@adatechnology/game-vehicles-three': patch
---

Tiro de fuzil fura o pneu e o deixa murcho, nunca o arranca da roda (a bala não gasta mais a fixação do pneu nem o quebra, só fogo, golpe forte ou rodar murcho o soltam). Farol ou lanterna quebrada ou furada apaga tudo o que a unidade desenhou (lâmpadas, tiras, ré, sinaleira); o halo e o feixe de luz de uma lâmpada apagada saem de `createVehicleLamps` e a lâmpada quebrada não acende de novo ao trocar a chave nem ao guardar as lâmpadas.
