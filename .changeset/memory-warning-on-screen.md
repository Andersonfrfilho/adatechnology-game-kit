---
'@adatechnology/game-test-room': minor
---

The room shows its memory and warns on screen when it leaks. The counters line adds geometries, textures and the JS heap (`geometries`, `textures`, `heap_mb` in `metrics()`). After each clear the room compares the GPU counts with the earlier clears of the same area: when they grew on each of the last four clears past the budget (40 geometries or 4 textures), a red banner stays under the tool, the log gets a `memory_leak` event and the counters line marks it, until a clear finds the memory back down. New `createMemoryWatch` and `RoomUi.alert`.
