---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

`onLoosened` is also called when furniture came apart and the renderer made what stayed a piece, with a new `cause` argument (`blast` or `apart`). The test room stops keeping the footprint of a table knocked over that way, so no invisible wall stays where it stood.
