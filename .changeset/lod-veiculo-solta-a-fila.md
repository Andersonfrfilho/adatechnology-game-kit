---
'@adatechnology/game-vehicles-three': patch
---

A área de veículos libera o LOD do veículo que saiu da cena antes de esquecê-lo. Desde a fila única `vehicles.lod-batch` (spec 010), os lotes do LOD ficavam nessa fila e seguravam o veículo inteiro: cada ciclo da sala deixava ~84 MB no heap (`leak.mjs`: explosões, vidro, áreas e tiros vermelhos na rodada diária desde 20/11).
