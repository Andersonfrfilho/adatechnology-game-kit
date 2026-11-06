---
'@adatechnology/game-contracts': minor
'@adatechnology/game-audio': minor
'@adatechnology/game-vehicles-three': patch
---

`AudioSink.preload(ids)`: o módulo pede para decodificar as gravações já ao carregar, e o primeiro uso toca o arquivo, não o sintetizado. A área de veículos
pré-carrega `VEHICLE_PRELOAD_SOUNDS` (motor, partida, desligar, portas e porta-malas): a primeira porta de carro aberta na 4280 tocava a receita.
