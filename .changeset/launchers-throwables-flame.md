---
'@adatechnology/game-weapons': minor
'@adatechnology/game-contracts': patch
---

Launchers, throwables and flamethrower with the rule of the team deliveries. A launcher returns the projectile (`throw` with `explosive`, `trigger: 'impact'`, `armDistance` 10 m) and the `backblast` (5 m, 19° cone); `arsenal.explosiveBody(use)` flies it with gravity, bounces, counts the fuse, arms by distance (a hit before it is a `dud`) and returns `detonate` with everything a host needs; `blastEffect` and `backblastEffect` say who is in the lethal or injury zone (cone of the Claymore, stun of the flashbang). Throwables follow their `ExplosiveDef` (fuse, fire, energy): the molotov now leaves fire of 4 m for 9 s instead of 1.5 m for 12 s. New throwables `flashbang`, `dynamite`, `c4` and `claymore` (`place` use for the last two). `ExplosiveDef` has `chain` (delays of the chain reaction of the world explosives) and the trigger `explosion`; `WeaponRules.explosives` holds gravity and bounce; `weapon.ts` is split into `weapon-core`, `weapon-commands`, `weapon-firearm` and `weapon` without change of behaviour.
