---
'@adatechnology/game-vehicles-three': minor
---

Freio chiando (`brake_squeal`, nos últimos metros de uma parada sem derrapar), atropelamento (`hit(speed, posição, som?)`, `vehicle_hit_pedestrian`,
com o id do jogo para outro corpo) e limite de motores audíveis (`createEngineBudget({ max, listener })`, passado em `createVehicleSound({ budget })`:
só os veículos mais perto do ouvinte mantêm os laços). A pista da sala passa o freio.
