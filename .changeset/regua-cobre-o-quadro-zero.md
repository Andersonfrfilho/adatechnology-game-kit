---
'@adatechnology/game-runtime': minor
'@adatechnology/game-test-room': patch
---

`scheduler.systemProbe`: gancho opcional de medição, avisado antes e depois de cada sistema de cada fase (`enter(id)`/`leave(id)`); sem sonda não faz nada além de ler uma propriedade por sistema. `SystemProbe` é exportado. Na sala de teste, `frameParts.scheduler` entrega o agendador à ferramenta de medição (`tools/gpu/room-explosion.mjs`).
