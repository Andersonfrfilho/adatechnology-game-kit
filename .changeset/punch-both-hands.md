---
'@adatechnology/game-characters-people': patch
'@adatechnology/game-characters-three': patch
'@adatechnology/game-test-room': patch
---

Punches alternate hands and the third-person punch reads as one. The room throws `hand`/`fists` punches right, left, right (`punchHand`: `alternate` default, `left`, `right`; `punchTools`) and logs the hand; `strike(clip, { hand: 'left' })` plays the mirror of the clip on the body and the left fist on the first-person arms (`arms.play(clip, { hand: 'left' })`). On the body, `punch_right` and `front_kick` now move the same arm and leg the first-person view shows (they moved the other side), the punch aims at the centre with the guard up, and the joints follow a clip that does not loop 5 times faster (`clipCascade`), so the arm reaches the shoulder by the impact instead of lagging halfway.
