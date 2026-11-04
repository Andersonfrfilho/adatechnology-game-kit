---
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-three': patch
---

A wall that comes down after the house drew its holes no longer leaves as an invisible piece: the house renderer keeps the plain positions of the ranges it collapses (`userData.plainPositions`), and the destruction renderer draws them again when the part leaves the mesh (`showCollapsedRanges`, and `extract` for ranges of a merged mesh). The fallen wall is drawn where the world has it, so shots hit only what is drawn and its bullet marks stay on it instead of floating in the air.
