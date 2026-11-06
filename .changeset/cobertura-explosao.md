---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-weapons-three': patch
---

Cover counts in a blast's push as it stood when the blast went off, and for light things too. `blastShove` takes the cover's share off the speed after the cap (`sqrt(reach) * min(maxSpeed, ...)`): a bottle behind a kitchen cupboard was thrown at the cap like one in the open, since a P13 gives a 0.5 kg body far more than the cap; in the open nothing changes. The destruction renderer reads the cover of each piece and shoveable body when a part of the world goes off, before the blast tears the cupboard apart or throws the stove into the line. The P13 push scenario reads the cover at the same moment and at the middle of what is drawn of each body, and bounds what a sheltered body may move by its share of what one of its kind went in the open nearer the blast.
