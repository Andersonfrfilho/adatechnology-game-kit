---
'@adatechnology/game-characters-three': minor
---

`createPlayerAvatar` gains `eye(out?)`, the world position of the body's eyes (a socket under the head moved by the new `eyeOffset` option, default `[0, -0.068, 0]`, read at the end of `update()` before any `reach()`), the `eyeBob` option (how much of the walking bob reaches the eye, default 0.5) and `setView('first' | 'third', camera)`, which stops drawing the head and neck for that camera only. The rich rig now exposes `neck`.
