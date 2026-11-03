---
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

Explosions and fire sound like what happened. `createDestructionSound` plays the family of each explosion from its effect (grenade, big charge, fuel vessel, car, pipe bomb, rocket, flashbang, molotov; `BLAST_KIND_OF`, changeable by option), the far rumble past 60 m and the indoor tail when the blast was confined; fire has its ignition "whoomp" (at most two at once when many parts catch together), a gas leak while a punctured vessel vents, a lower roar and crackles at the burning points (`update(dt)`). The renderer sends the explosion's effect, radius and confinement with `explode` (`SoundDetail`). game-audio adds the `kit` mix (the art scene chain plus a soft limiter with a −1 dBFS ceiling), now the default: a blast with its debris no longer clips the output. The room passes the thrown explosive's id to the renderer and ticks the fire crackles.
