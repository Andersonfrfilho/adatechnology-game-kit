---
'@adatechnology/game-characters-people': minor
'@adatechnology/game-characters-three': patch
'@adatechnology/game-test-room': minor
---

A punch combo as an ability. `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` gain `jab`, `hook` and `uppercut` (written for the right hand, the left plays the mirror), and `PUNCH_COMBO` (`StrikeCombo`) chains jab (left), cross (right), hook (left), uppercut (right). The test room takes it as `strikeCombo`: while it is on (N, its button, `setStrikeCombo`, `strikeComboOn`) each punch is the next step and a pause longer than `reset` starts over; off, the punch is the usual one. The player body closes the hands for any clip whose impact is a punch.
