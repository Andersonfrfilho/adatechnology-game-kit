---
'@adatechnology/game-test-room': minor
---

Breaking (0.x, so minor): the room no longer ships the procedural demo catalogue or its built-in scenarios. Removed: `demoItems`, `DEMO_ITEMS`, `DEMO_MATERIALS`, `SCENARIOS`, `scenariosFor`, `makeScenarios`, the demo item names of the locale tables and the `sc.*` texts of the removed scenarios. Pass `catalog: []` and load the SDK modules with `room.loadModule`; scenarios come from the host and the modules. `brickWallSpec` stays (the arena's target wall). See the README section "Breaking".
