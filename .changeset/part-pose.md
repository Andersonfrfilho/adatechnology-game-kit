---
'@adatechnology/game-contracts': patch
'@adatechnology/game-destruction': patch
'@adatechnology/game-test-room': patch
---

Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.
