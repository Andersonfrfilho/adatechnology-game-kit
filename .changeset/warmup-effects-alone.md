---
'@adatechnology/game-render-three': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-test-room': patch
---

The warmup draws each effect alone: `EffectWarmup.root` names the subtree the effect draws under, and for its frames every other drawable of the scene is hidden (lights, and whatever holds one, stay, so the program keys are the game's). `VfxRenderer.root` is the group every effect draws under; the test room passes it for the nine blasts it warms. The room was drawn in full 27 times per warmup only to warm the blasts: the second warmup of the room's load went from 62 s to 17 s with software GL, and the page opens in 71 s instead of 113 s.
