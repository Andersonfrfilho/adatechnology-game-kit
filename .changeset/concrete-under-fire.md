---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.
