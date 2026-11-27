---
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vehicles-three': patch
'@adatechnology/game-kit-defaults': patch
---

refactor(vehicles): o kernel do plano de cascos (`hullPlanKind`, `planHulls`, `hullOf`, `convexFaces`...) mora em `game-vehicles` (subcaminho `./worker-kinds`); `game-vehicles-three` reexporta, e o preset deixa de depender de `game-vehicles-three`, sem ciclo de pacotes.
