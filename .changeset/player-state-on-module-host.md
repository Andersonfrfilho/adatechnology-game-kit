---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-weapons-three': patch
---

`ModuleHost.player()` returns a generic `PlayerState` (`position`, `yaw`, `pitch`, `crouching`, `speed`, `running`, `cameraMode`), and `HostEvent` gains `{ type: 'player' }` for when crouching or the camera mode changes. A host implementing `ModuleHost` must add `player()`. The test room answers from its player controller (not crouching, first-person camera for now).
