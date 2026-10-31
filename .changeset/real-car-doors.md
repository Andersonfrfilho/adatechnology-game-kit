---
'@adatechnology/game-vehicles': patch
'@adatechnology/game-test-room': patch
'@adatechnology/game-destruction': patch
---

A car door that opens is the door itself: the first swing cuts the door's own skin out of the body and hangs it on the hinge, with its trim and side window, in place of the flat plate (the lid takes its skin too). The room moves a part's collision shape round the hinge its drawn group turns on, not round the shape's own centre, so a car door no longer stops against its own body. `sweepBox` with `ignore` also ignores the parts of an object hosted by an impl (a vehicle).
