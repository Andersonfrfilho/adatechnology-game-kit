---
'@adatechnology/game-audio': minor
'@adatechnology/game-vehicles-three': minor
---

Sons de carro gravados por referência. `game-audio`: `SampleRef.offset`/`duration` (um trecho do arquivo, com fade no corte), `SampleSound.baseFrequency`
(o laço gravado segue `set({ frequency })` pela taxa de reprodução), laço gravado com posição (queda e lado pelo ouvinte) e `SoundBank.sampleAliases`
(um id do pacote toca as tomadas de um id do manifest, resolvido na consulta). `game-vehicles-three`: `VEHICLE_SAMPLE_ALIASES` liga o motor do carro
(marcha lenta a 1 000 rpm, alta a 2 520 rpm) a `rpm / rpm gravado`, a partida e o desligar recortados de `engine_start_run_stop`, a porta e o
porta-malas aos arquivos do jogo; sem os arquivos, tudo continua sintetizado.
