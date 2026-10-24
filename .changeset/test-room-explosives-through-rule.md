---
'@adatechnology/game-test-room': minor
'@adatechnology/game-contracts': minor
---

The test room throws grenades, launches rockets and sets charges down through `ExplosiveBody` of `game-weapons`: the fuse counts from the throw, an impact before the arming
distance is a dud, the Claymore only reaches its cone (`blastEffect`), the blast behind a launcher is counted (`backblastEffect`) and the player's own zone is logged. Y
detonates the charges set down. `HostEvent` gains `explosion` (thrown, set down or a part of the world, with the point, energy, reach and cause) for modules that play the
sound, and `ModuleHost.configureTool({ condition, ammoQuality })` sets the wear of the tools and the quality of their ammunition from a module's bench.
