---
'@adatechnology/game-weather-three': minor
---

The bench's lamp rig no longer draws its own car (a dark box with two lamp plates). `createWeatherVisual({ vehicles })` takes the vehicles SDK (`createVehiclesThree` of game-vehicles-three with the fleet installed) and mounts the headlights on a fleet car (`rigVehicle`, default `midsize_sedan`), so the rig follows the fleet; without it the rig has only the lamps and their beams. New exported type `RigVehicles`.
