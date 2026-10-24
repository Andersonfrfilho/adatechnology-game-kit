---
'@adatechnology/game-weather': minor
---

`createWeatherTestModule` is the weather area of the test room, written against the generic contracts only: weather, transition (at once or 10 s), hour of the day, automatic schedule (600 times faster) and seed; it writes the weather to `host.environment` and to the scene fog (layer `fog`, off with `fog: false`) every frame, and shows rain, visibility, sight and hearing scale, wind, heat index, wet ground and strikes. Four scenarios: storm, blend, determinism, dry ground. `@adatechnology/game-contracts` is a dependency (types only).
