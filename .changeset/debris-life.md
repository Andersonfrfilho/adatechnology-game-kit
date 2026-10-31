---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
---

How long debris stays on screen is configurable per fragment: `fragmentLife` takes a rule `(fragment, objectId) => seconds` besides a number (0 = forever), so rubble can stay and chips can go by material, size or object. The test room takes `debris: { fragmentLife, maxFragments, particles }`, where `particles` tunes the dust, smoke and chip sprites by kind.
