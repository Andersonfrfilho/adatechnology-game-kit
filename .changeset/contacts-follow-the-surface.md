---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-floorplan-three': patch
---

A piece's contacts follow the surface it rests on: on another piece the push is along the normal of that piece's face (a tilted table top pushes across itself,
not straight up), and friction is Coulomb in the plane of the surface, static while the point holds and dynamic while it slides (0.7 and 0.6 unless the piece
says otherwise, mixed by geometric mean between two pieces). A box on a top tilted past atan(μ) slides down it toward the low side; gentler, it stays. Pieces on
the top of another are no longer pushed sideways off it by the separation of pieces side by side. The floor plan's golden hashes of the three house destruction
scenes change with the solver.
