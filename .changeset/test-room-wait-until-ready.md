---
'@adatechnology/game-test-room': minor
---

`setTool` plays the draw of the rule (the tool answers `drawing` until it is over), so a script that equips and fires at once needs to wait: new `room.waitUntilReady(maxSeconds?)` advances frames until the tool in hand has no phase and returns the seconds waited. The built-in scenarios use it instead of a fixed 0.4 s.
