---
'@adatechnology/game-test-room': minor
---

The room lends `host.audio` (a sink over the room's sound engine, the listener following the camera every frame) and `host.environment` (a bus; calm dry day by default) to the modules it loads. New options `audio` (an engine, or `false` for a silent room) and `environment`, and `room.audio` and `room.environment`. The destruction renderer's sound keys play on the room engine.
