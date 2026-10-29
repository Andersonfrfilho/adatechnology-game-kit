---
'@adatechnology/game-contracts': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-vegetation-three': minor
'@adatechnology/game-crowd-three': minor
'@adatechnology/game-animals-three': minor
'@adatechnology/game-vehicles-three': minor
---

A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
