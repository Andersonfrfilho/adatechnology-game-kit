---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-terrain': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

Amortecimento de rolamento por material: além da resistência ao rolamento (C_rr), cada material da peça (`surfaceOf`: vidro e aço 0,02/s, madeira 0,4/s, borracha 0,3/s, tecido 1/s) e cada chão (`TerrainMaterial.rollingDamping`: concreto 0,3/s, cerâmica 0,1/s, grama 1,5/s, areia 2/s, lama 3/s) tiram uma parte do giro por segundo, e os dois se somam: a garrafa rola mais no piso liso, a tora para logo na grama. Cerâmica e madeira de piso passam a ter C_rr 0,008 e 0,01 (antes o 0,015 padrão). Contrato: `Rolling.damping` e `Material.rollingDamping`; o adaptador Jolt aplica os dois em todo corpo com `rolling` (`rollingImpulse`), e o `saveState` guarda o amortecimento. Terreno: `rollingDampingAt`. Renderizador: `terrainRollingDampingAt` (a sala de teste liga ao terreno). Em rampa a peça continua rolando, e um impulso a acorda e ela volta a rolar. Medição na sala: `examples/test-room/rolling-test.mjs`.
