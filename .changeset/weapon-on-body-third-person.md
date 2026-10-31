---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-test-room': minor
---

Third person draws the weapon on the body at its real size: new optional `ModuleHost.holdFrame()` (the pocket of the right shoulder turned to the aim; null in first person), which the test room lends from the avatar's new `shoulder(side)`. The weapons viewmodel puts a long gun's stock in the pocket (a launcher slides back until its grip is in reach), a handgun or a one-hand tool at a ready grip, and caps the support hand's span at 0.5 m. Looking up or down no longer drives the arms into the body.
