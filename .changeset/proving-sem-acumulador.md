---
'@adatechnology/game-vehicles-proving': minor
'@adatechnology/game-vehicles-three': patch
---

O banco de provas deixa de ter acumulador próprio (spec 010 T3.8): `ProvingRun.step(dt)` sai; o agendador anda a corrida com `stepFixed(STEPS_PER_TICK)` na fase `fixedSimulate` (e `advance(seconds)` para quem roda sozinho, sobre um agendador do `game-runtime`). O `time_scale` da área vira quantos tiques de passos cada tique roda. Mesma trajetória a 60 Hz.
