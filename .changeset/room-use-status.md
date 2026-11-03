---
'@adatechnology/game-test-room': minor
---

`TestRoom.use()` answers what the trigger said (`UseStatus`: `ok`, `drawing`, `cooldown`, `empty`...), so a script knows when a pull did nothing. `tool.phase` turns null in the frame that ends the draw, which is the trigger's frame too: a pull before the next frame answers `drawing` and throws nothing. The explosion budget (`examples/test-room/perf.mjs`) pulled there now and then on software GL, where a frame outlasts its 300 ms wait, and failed with "no blast after frag_grenade"; it now pulls again on the next frames until the trigger takes it.
