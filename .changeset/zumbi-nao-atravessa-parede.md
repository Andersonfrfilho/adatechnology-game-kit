---
'@adatechnology/game-contracts': minor
'@adatechnology/game-crowd': minor
'@adatechnology/game-floorplan-three': minor
---

Zumbis não atravessam mais paredes: as casas publicam paredes do térreo, muros, grades, portas e portões (`createHouseNavObstacles`, contrato `NavObstacleSource`) e a horda os grava na sua grade (`bindNavObstacles`). Contornam a parede, entram por porta ou portão aberto e pelo buraco de uma explosão, e batem na porta fechada até quebrá-la (a casa a mostra aberta).
