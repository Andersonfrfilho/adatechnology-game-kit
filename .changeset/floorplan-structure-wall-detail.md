---
'@adatechnology/game-floorplan-structure': minor
---

Wall detail and test walls (spec 001, T2.2d): `toDestructibleSpec` cuts each wall at its windows (piers, sill, reinforced concrete lintel bearing 0.2 m on the piers, wall above) with the
`game-destruction` assembly of each piece (plaster that spalls, rebar, stages, breach) and keeps the mass of the wall; a door gap gets a lintel that carries the bond beam. `wallDetail: 'units'` lays bricks, blocks and
concrete panels one by one; log walls are courses of logs. `buildWallSpecimen` builds the 2.4 x 2.1 m test wall of any assembly, whole or with a door or a window.
