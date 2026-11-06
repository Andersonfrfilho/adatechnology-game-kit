---
'@adatechnology/game-contracts': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-characters-three': minor
---

A weapon in each hand, finished. The magazine change frees a hand as a person does: the other weapon is tucked in the belt (`rules.dualWield.stowSeconds`, 0.45 s), the free hand goes to the magazine well of the weapon being reloaded and back, the weapon is drawn again, then the same the other way round; neither weapon fires meanwhile. The contracts gain `HostTool.stowed`, the `stow` host event and `HandTargets.fingersL` (the left hand's index finger, as `fingers` is the right's); the first-person arms and the player's body curl each index finger by it (the body's right index now follows `fingers` too). Q (fire mode) and B (safety) act on the weapon of the hand that fired last, and X clears the stuck weapon (the last-fired one first).
