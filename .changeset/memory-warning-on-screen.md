---
'@adatechnology/game-test-room': minor
'@adatechnology/game-terrain-three': patch
---

The room shows its memory and warns on screen when it leaks. The counters line adds geometries, textures and the JS heap (`geometries`, `textures`, `heap_mb` in `metrics()`). After each clear the room compares the GPU counts with the earlier clears of the same area: when they grew on each of the last four clears past the budget (40 geometries or 4 textures), a red banner stays under the tool, the log gets a `memory_leak` event and the counters line marks it, until a clear finds the memory back down. New `createMemoryWatch` and `RoomUi.alert`.

The terrain area frees its strip labels (plane, material and canvas texture) when it closes, and a new lint rule (`kit/no-bare-remove`) fails a `removeFromParent()` in a function that frees nothing.
