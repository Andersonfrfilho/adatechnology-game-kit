---
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-fluids-three': patch
'@adatechnology/game-test-room': minor
---

Cans dent where they are hit and are holed on the lid, the bottom and the rim as on the side. An item family can give its shell the real wall thickness (`rule.wall`: a drink can is 0.1 mm on the body and 0.25 mm on the ends, a food tin a bit more); `tagForDestruction` writes it as `userData.destructionThickness` and `specFromObject3D` uses it for the part, so a 9 mm goes through a lid even at a slant. With `tessellate.cylinder.capRings` (and `three` passed to `tagForDestruction`, as `buildItem` does) each cylinder of the model becomes one lathe with rings on its ends and rows as fine as its columns, and a model drawn as a lathe gets the same columns, so the lid and the bottom have vertices to dent. In the world a ductile sheet 0.5 mm thin or less folds deeper than a plate for the same blow (up to 4 times), on a patch no wider than 2.5 cm and never past near its middle, and the slit a blade cuts in it is pushed in around. A skin follows its shell past the degenerate triangles of a lathe. The liquid of an opaque container is not drawn through a narrow mouth (a can's tab) nor through the bullet holes drawn on it.

The test room pushes what a round hits at the point of the drawn surface it meets, along that surface's inward normal (plus a share along it), with the momentum the round lost there: all of it when it stopped, through a thin shell only what the wall and the liquid inside took. A round on the right of a can pushes it away and to the left and spins it; before, it got the whole momentum of the round along the shot at the box the world sees.
