---
'@adatechnology/game-contracts': minor
'@adatechnology/game-audio': minor
'@adatechnology/game-player': patch
'@adatechnology/game-test-room': patch
---

`urgent` on a play (`PlayOptions`, `SoundRequest`): the voice is built at once instead of in the deferred start queue. The body's sounds use it (footsteps, jump, landing, swing, hit): at a low frame rate the queue started the hit of a knife, an axe or a bat 60 to 500 ms late, or dropped it.
