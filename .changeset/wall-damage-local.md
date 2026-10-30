---
'@adatechnology/game-destruction': patch
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-vfx': minor
---

Wall damage stays where the shot lands. The house no longer redraws a whole wall as plain white blocks on the first brick that comes out: the wall keeps
its geometry, plaster and paint, and is cut by a mask only where units came out, with a ragged edge of plaster and the bricks (in their mortar) or the
rough concrete of a beam showing around the hole. Bullet holes, spalls and the impact marks of the effects go with the brick that comes out
(`DecalPool.clearInside` in game-vfx). A bullet now wears only its stretch of a joint (`BULLET_JOINT_SPAN`), so a row of shots along a ten-metre wall no
longer opens the whole mortar bed and brings the wall down.
