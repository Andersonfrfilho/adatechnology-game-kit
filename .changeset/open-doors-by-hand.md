---
'@adatechnology/game-player': minor
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-floorplan-three': minor
---

Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
