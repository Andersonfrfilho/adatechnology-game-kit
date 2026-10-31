---
'@adatechnology/game-player': patch
'@adatechnology/game-test-room': patch
---

A leaf left between closed and open goes the other way from where the last use sent it: a door that hit something while opening closes on the next E instead of trying to open again forever (`DoorUseTarget.lastGoal`, `DoorUseRules.endTolerance`; the room remembers the last way of each leaf). At either end the old rule holds, so a leaf put back by a reset opens.
