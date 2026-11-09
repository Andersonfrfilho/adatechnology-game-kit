---
'@adatechnology/game-destruction-three': patch
---

Two loose box pieces that overlap are now put apart by their real boxes, not by a circle of their largest half side: `shapeContact` answers two box shapes
with a separating-axis test (the 15 axes of two oriented boxes, per part) and `separatePair` moves them along the axis they overlap least on, by that depth
(side by side along the ground, split by mass; one over the other, only the upper rises), at most 1.5 m/s, and stops the speed they close in with. Two thin
slabs standing 10 cm into each other end side by side where they were (they were shoved 4.8 m apart along their length), and two boxes side by side end
touching instead of still 8 cm into each other.
