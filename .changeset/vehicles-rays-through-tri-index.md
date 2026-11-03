---
'@adatechnology/game-vehicles': patch
---

The rays that seat the windshield and rear window on the shell, `kit.probe` and `kit.surfaceAt` go through the triangle index of each mesh (`raycastIndexed` in `tri-index`): a ray visits only the blocks and triangles whose box it crosses instead of every triangle of the body, with the same triangle test as three.js, so the hits are the same (a test compares them ray by ray). A vehicle builds in about half the time; the vehicles test area tests no longer run past vitest's 60 s report timeout.
