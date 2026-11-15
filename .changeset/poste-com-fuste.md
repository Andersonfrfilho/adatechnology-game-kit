---
'@adatechnology/game-shapes': minor
'@adatechnology/game-destruction-three': patch
---

`fitOrientedBoxes(points, triangles?)` passa a aceitar também os triângulos da peça. Assim, uma peça desenhada por anéis de vértices, como poste, cano ou fio, é segurada pelo corpo inteiro, e não por placas nas pontas. O mesmo vale para um cano em L, que segue a curva e não vira uma placa de ar atravessando a dobra.

O poste de concreto do lote colide como fuste de 7,5 m, com cruzeta e isoladores. Deitado, ele dorme em cerca de 2 s com o Jolt.

Sem os triângulos, o resultado da função continua o mesmo de antes.
