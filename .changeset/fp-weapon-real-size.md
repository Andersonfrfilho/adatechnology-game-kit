---
'@adatechnology/game-weapons-three': patch
---

The hands always take the tool's scale (they shrank only to `scale ** 0.55`, so a weapon drawn smaller looked like a toy in them), and the wall pull reaches the weapon's own length when it is longer than `WALL_PULL.max`. A test fails when the hands and the weapon in first person are drawn at different scales.
