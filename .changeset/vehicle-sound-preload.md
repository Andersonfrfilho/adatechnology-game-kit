---
'@adatechnology/game-contracts': minor
'@adatechnology/game-audio': minor
'@adatechnology/game-vehicles-three': patch
---

`AudioSink.preload(ids)`: o módulo pede para decodificar as gravações já ao carregar, e o primeiro uso toca o arquivo, não o sintetizado. A área de veículos
pré-carrega `VEHICLE_PRELOAD_SOUNDS` (motor, partida, desligar, portas e porta-malas): a primeira porta de carro aberta na 4280 tocava a receita.

`SampleAlias.only`: o recorte vale só para as tomadas cujo arquivo contém esse trecho. A partida e o desligar do carro foram medidos na tomada `_01` de
`engine_start_run_stop`, mas o jogo também sorteava a `_02` (21,9 s, que começa com o motor já ligado), e em metade das vezes o desligar tocava
marcha lenta. Agora os dois usam só a `_01`.

`loadSamples(ids)` lembra os ids que ainda não têm arquivo (o manifest ainda carregando) e carrega assim que um banco os resolve: o pré-carregamento
da área de veículos acontece antes de o manifest chegar, e a primeira partida ainda tocava a receita.
