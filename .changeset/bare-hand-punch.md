---
'@adatechnology/game-test-room': patch
---

Bare hands punch at the click again: the default tool (the hand) used to only grab on the left button, so the punch clip never played. Now the click punches (`strikeClips.hand`, on the arms and on the body), lets go of what is held, and E or the right button grab; `room.use()` does the same. A click pressed and let go between two frames is no longer lost.
