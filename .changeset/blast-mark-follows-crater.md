---
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': minor
---

The scorch and dirt marks of a blast follow the crater the host's terrain dug instead of lying flat over it and hiding it: `VfxWorld.hostGroundAt` hands over the host height (`VfxOptions.groundAt`), the renderer passes it to the mark layer (`MarkLayerOptions.heightAt`), and where the ground dips under the mark its grid is finer (20 steps per metre, up to 64) so it reaches the bottom of the bowl; flat ground keeps the Explosion Lab grid.
