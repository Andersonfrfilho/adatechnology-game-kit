---
'@adatechnology/game-kit-defaults': minor
'@adatechnology/game-destruction-three': minor
---

Workers ligados por padrão (spec 009, T6, T7 e T13): `createKitWorkers` e `KIT_WORKER_KINDS` no preset, com o arquivo do worker do kit (`dist/kit-worker.js` e `dist/kit-worker.global.js`); o chão da cratera vira a categoria `destruction.ground-tiles` (`groundTilesKind`, entrada sem three.js `./worker-kinds`) e passa pelo coordenador com `createCoordinatorGroundPort`. A sala usa um coordenador por página, com o chão por ele por padrão (`?groundWorker=0` desliga, `?workers=N` escolhe quantos).
