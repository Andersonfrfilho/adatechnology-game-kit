---
'@adatechnology/game-vehicles-three': minor
---

O módulo de veículos usa `host.audio`: registra o banco da biblioteca do `game-audio`, toca o motor da pista (`engine_saw`, volume 0,035 + velocidade x 0,003 e frequência 38 + velocidade x 7, valores do jogo) e a buzina (`horn`, ação "Buzinar" da bancada), e o som de batida (`sfx_impact`) quando o carro da pista bate. Vidro, impacto e explosão já saem do som de destruição da sala.
