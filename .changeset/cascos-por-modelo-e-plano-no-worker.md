---
'@adatechnology/game-vehicles-three': minor
'@adatechnology/game-contracts': minor
---

feat(vehicles): the hulls of a model are made once (`createHullPlanCache`, `planCache`), the first division runs in the worker coordinator as the `vehicles.hull-plan` kind (`@adatechnology/game-vehicles-three/worker-kinds`, `workers` option, `isHullPending()`), and the second car of a model is given its hulls in under 2 ms. `WORKER_KIND_ID.VEHICLE_HULL_PLAN` in the contracts.
