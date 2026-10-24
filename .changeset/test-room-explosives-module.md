---
'@adatechnology/game-test-room': patch
---

The projectiles, charges set down and the blast behind a launcher moved out of `room.ts` into `explosives.ts` with an injected context. A thrown item that names no explosive now blasts through the same function as every other (explode log entry, host `explosion` event, player share and fire), and its flight uses `rules.explosives.gravity` instead of a fixed 9.81.
