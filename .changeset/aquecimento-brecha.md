---
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-test-room': minor
---

The first shot or blast on a wall no longer builds shader programs in play. `wallPiece` gives `warmUpProbes(THREE)`: the wall drawn with one brick shot out of it (the breach's shell and its bare bricks, instanced, lit and in the shadows), for a host to draw once at load; its `dispose` frees geometries and textures and leaves the materials to the host's warmup, which keeps the programs alive. A room's `SceneryObject` takes `warmUpProbes`, and the room draws them with its other probes; the test room passes the target wall's.
