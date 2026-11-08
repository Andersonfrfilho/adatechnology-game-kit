---
'@adatechnology/game-weapons': minor
'@adatechnology/game-terrain': patch
'@adatechnology/game-test-room': patch
---

A launched round (rocket, 40 mm grenade) always goes off where it lands, on any ground, wall or object, however close: an impact before the arming
distance detonates by default (`rules.explosives.unarmedImpact: 'detonate'`; `'dud'` keeps the real safety of the fuze). Two safety fuzes: a launched
round that comes to rest goes off (`restSpeed`), and one that hits nothing self-destructs (`selfDestructSeconds`, 20 s). `sweepGround` reads the ground
along the whole step, so a fast round cannot cross a heap, a kerb or a crater rim between two frames. The ground of the destruction world answers rays
with its surface as it is now (`surfaceRay`), so a round fired into a crater goes off on its floor instead of in the air over the old flat level.
