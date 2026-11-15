---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

Os fios do poste do lote soltam-se em trechos que não vão com o poste. Antes, cada trecho da fiação pendia do poste por uma junta que sempre une; ao cair, o poste levava os fios que a explosão não tinha soltado e virava um corpo de 1000 kg com 26 caixas e 23 m de largura, e a varredura contínua (CCD) do Jolt custava 60 a 70 ms por passo. Agora o poste leva só o fuste, a travessa e os isoladores (950 kg, 10 caixas) e cada trecho de fio cai como peça sua, com o próprio cobre.

`game-contracts`, `game-destruction`: `JointSpec.tears` (padrão falso). A parte `a` pende de `b` só enquanto `b` está de pé (em um grupo ancorado); com `b` solto a junta larga, e o fio de um poste que cai desce sozinho. Uma junta que não rasga continua unindo as duas partes em um grupo. Quem se segura em duas pontas, uma delas de pé (o fio do ramal preso à parede da casa), fica pendurado nela.

`game-destruction-three`: as peças que um `tears` separou (o fio e o poste de que pendia) não se tocam mais: sem isso o poste de 950 kg, ao tombar, batia nos fios de 12 kg que ele acabava de largar e os lançava (C1 de 34 e 105 kg·m, C2 acima do limite em 4 de 10 rodadas). `JointState.tears` (contrato), `PieceSystem.tether`, e o renderizador marca os pares ao soltar os grupos.

`game-floorplan-structure`: `Support.tears` chega à junta da especificação destrutível.

`game-floorplan-three`: os trechos da grade e do ramal pendem do poste mais próximo por uma junta que rasga (`tears`); o trecho que fica dentro de laje ou parede, ou ao lado de um, continua preso a ela. Com `segmentLimits.wiring: Infinity` a fiação segue como o time desenhou (uma peça só). Goldens regravados: `destruction/breach`, `destruction/spall`, `destruction/fracture` e o resultado do blast (21 objetos a mais, os trechos).
