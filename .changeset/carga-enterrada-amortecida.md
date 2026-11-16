---
'@adatechnology/game-destruction': minor
'@adatechnology/game-contracts': minor
---

`BlastOptions.soilCover` (metros de solo sobre a carga): `world.explode` entrega às estruturas só a parte da energia que o solo deixa sair (`buriedTransmission`, profundidade escalada pela raiz cúbica da carga em TNT, raio e raio letal pela raiz cúbica dessa parte) e o solo segura os fragmentos do invólucro. Sem `soilCover` nada muda (porão, cratera e peças abaixo de y = 0 não são solo). O evento `explode` continua informando a carga inteira.
