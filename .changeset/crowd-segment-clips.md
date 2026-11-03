---
'@adatechnology/game-characters-three': minor
'@adatechnology/game-crowd-three': minor
---

Segment clips in a texture (step 3 of the ladder, option `variety.segmentClips`, default off): `bakeSegmentClips` samples 14 clips at 30 Hz (a walk, a limp on each side, a drag, a lurch, a shamble and a stagger, each with the arms down and raised) from the maths of the shader's walk into 12 bones of 24 texels, `createSegmentClipUniforms` makes the RGBA32F `NearestFilter` texture, and a body material built with `segmentClips` walks the bodies flagged `clips` in `iD` from it: the clips of the agent's gait family blended by how far it has raised its arms, the amplitude scaled by its gait, the phase and the cadence its own. Shadow and distance materials read the same texture. The other poses stay on the shader's procedural pose.
