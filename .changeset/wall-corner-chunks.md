---
'@adatechnology/game-floorplan-three': patch
'@adatechnology/game-destruction': patch
---

Shots at the corners and ends of a wall no longer draw anything outside it. The structure's part of a wall reaches half the thickness past each end (to close a corner), and the breach view laid its bricks and bond-beam blocks on that part, so a hit near an end drew a grey block (the bond beam's concrete) and bricks up to 8 cm past the wall's edge. The units laid bare are now clipped to the box of the wall as the house drew it (`clipToBox`).

A shot near a free side of a unit tears the corner off out to that side instead of leaving a crater inside it: the ends of the wall, its top, and the side a unit already knocked out left open, so the edge a torn corner leaves tears off in turn. How close counts grows with the round's energy (1.5 crater widths: about 11 cm for a 7.62, 7 cm for a 9 mm).
