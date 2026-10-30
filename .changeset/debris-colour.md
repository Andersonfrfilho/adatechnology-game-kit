---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-destruction-three': patch
---

Crushed masonry takes the colour of its material: brick, concrete, plaster and stone get `visual.innerColor`, the `debris` event names the material of
the bits when it is not the part's own (`material`, the plaster coat over a brick wall), and the renderer throws chips and dust and draws spalls in that
colour (brick orange, plaster light, concrete grey) instead of the dark grey of the generic concrete impact.
