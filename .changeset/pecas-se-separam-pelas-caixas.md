---
'@adatechnology/game-destruction-three': patch
---

Two loose box pieces that overlap are now put apart by their real boxes, not by a circle of their largest half side, and nothing is launched doing it.
`shapeContact` answers two box shapes with a separating-axis test (the 15 axes of two oriented boxes, per part), and `boxesAlongGround` gives the least
overlap along the ground. `separatePair` takes back half the overlap per step, summed over every pair of a piece and bounded per piece at 1.5 m/s
(`applyPushes`), never down. Side by side, the two go apart along the ground, split by mass. One over the other as deep as a contact (3 cm, plus what
the closing speed sank them this step), only the upper rises, and a contact impulse at the point stops it sinking (`propped`: the support counts for its
rest). Deeper, the two were made inside each other: they slide apart along the ground instead of the upper being lifted out. The resting gates
(stacked, on a top, leaning on a part) no longer hide two pieces deep inside each other, nor two side by side. In a collapsed sobrado no chunk's centre
rises more than 3.5 cm (it was up to 4.1 m with the plain separating axis). A piece split off with several parts (a board and its books) is landed on
by its parts as drawn, not by the box around them.
