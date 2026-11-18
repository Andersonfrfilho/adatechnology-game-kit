---
'@adatechnology/game-vehicles-three': patch
---

Tiro no carro sem lag. Depois do #379, o carro atingido que ficava 1,5 s quieto desmanchava todos os lotes para refazer com as peças amassadas: por vários quadros ele desenhava cada peça sozinha (~590 chamadas) e juntava 320 mil vértices de novo, com quadros de até 63 ms. Agora os lotes das peças paradas ficam como estão e só as peças que saíram entram num lote novo, delas. Numa rajada de 30 tiros de AK no sedã visto de longe, a pior atualização do LOD caiu de ~90 ms para 8 a 15 ms, sem o pico de chamadas.
