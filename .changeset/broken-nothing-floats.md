---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
'@adatechnology/game-floorplan-three': patch
---

Broken objects: nothing floats, nothing invisible collides. After each break the renderer checks what is left of the object on the next update (`onBrokenChecked`)
and lets go at once what stood on something and lost it; whatever is not a structure loses its footing by the same rule as furniture. What lay asleep on a piece
wakes in the same update that piece starts to move. `shownBoxes(objectId, partId?)` gives the world boxes of what is still drawn. The test room measures the player
against those boxes (a broken leg leaves no collider), logs a `broken_floating` failure when the check had to let something go, and looks for what a thrown body
hit from the hip to the shoulder. The floor plan's golden hashes of the two house destruction scenes change: debris asleep on pieces that move now wakes.
