---
'@adatechnology/game-destruction': patch
---

Ballistic hits now only wear the joints of the part they hit, scaled by the energy that part absorbed (a bullet that goes through transfers little), instead of opening every joint near the entry point. A joint that opens now stays listed in `state(objectId).joints` with `open: true` and `openedBy`, even after `splitGroup` moves its parts.
