---
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-destruction': patch
---

Faster pieces and rays. An update split into steps for a round piece (so a can is not passed through) now splits only that piece and what closes in on it; the
rest (a wall's bricks falling far from it) take the update whole, so their sweep against the world runs once instead of up to eight times. A ray tries each part of an
object against its bounding sphere in the object's frame before its shape, so a ray through a house of a thousand bricks tests a handful. The floorplan destruction
tests went from about 400 s to under 100 s on CI.
