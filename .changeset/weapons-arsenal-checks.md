---
'@adatechnology/game-weapons': patch
'@adatechnology/game-weapons-three': patch
---

`checkArsenal` (and so `createArsenal`) reports a `defaultCondition` or `defaultAmmoQuality` that the rules do not define, the rules patch ignores `__proto__`, `constructor` and `prototype` keys, and `weaponsLayout` throws when the weapons do not fit on the counters instead of stacking them on the last one.
