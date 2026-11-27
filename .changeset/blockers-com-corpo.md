---
"@adatechnology/game-contracts": patch
"@adatechnology/game-destruction-three": patch
"@adatechnology/game-test-room": patch
"@adatechnology/game-floorplan-three": patch
"@adatechnology/game-weather-three": patch
"@adatechnology/game-vehicles-three": patch
---

Os obstáculos que um módulo põe na sala ganham corpo no motor (T8.1). `game-contracts`: `ModuleHost.addBlocker(blocked, solids?)` aceita as caixas do mesmo obstáculo (`HostSolid`, `footprintSolid`). `game-destruction-three`: `DestructionRenderer.setHostSolids` põe caixas fixas de um módulo no motor. `game-test-room`: com motor, o corpo segura o jogador no lugar do veto (tiro, destroço, carro e explosão passam a encontrá-lo); o poste da torneira também é corpo. `game-floorplan-three`: paredes, portas fechadas, muros do lote e móveis da casa. `game-weather-three` e `game-vehicles-three`: o carro do banco de luzes e o da pista. Sem motor (`own`) o veto continua.
