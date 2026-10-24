---
'@adatechnology/game-contracts': minor
---

Contracts for explosives and chain reactions. `Use` of kind `throw` carries the explosive it throws (`explosive`, `trigger`, `armDistance`, `injuryRadius`, `stunSeconds`) and there are two new kinds: `place` (a mine or charge set down that waits for a wire, a remote detonator or a timer) and `backblast` (the danger zone behind a rocket launcher). `PartSpec.explodes` takes `chain` (`ExplosionChain`): what sets the part off before it is destroyed (`shot`, `fire`, `explosion`) and the seconds until the blast. `DestructionEvent` has a new `primed` event for it. All additive; a host that switches over `Use` or the events needs no change.
