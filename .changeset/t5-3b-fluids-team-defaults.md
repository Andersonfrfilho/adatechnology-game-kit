---
'@adatechnology/game-fluids': minor
'@adatechnology/game-fluids-three': patch
---

The team's values as the fluids defaults (T5.3b, spec 001 decision E2). `blood`: `stainColor` `0x3B1D14` (was `0x4A0506`) and `dryTime` 600 s (was 1200). `fuel`: `dryTime` 60 s (was 120) and `leavesMark: false` (was `true`: it evaporates and leaves nothing). `water`: `dryTime` 180 s (was 600). New liquids `old_blood` (`0x6C1C16` drying to `0x2A160E`, 360 s) and `bile` (`0x8A9A2A` to `0x3E4220`, 900 s), with `en` and `pt-BR` names. A game that wants the old values replaces the liquid by id: `createFluids({ liquids: [{ ...blood, dryTime: 1200, stainColor: 0x4a0506 }] })`. New `splash(liquid, point, liters, velocity, { tint: { fresh, dry } })` colours one splash and the stain it makes or joins (`StainState.tint`, kept by `serialize` and `load`), so the age of an infection stays in the characters' data and the liquid stays generic. The README imports `DestructionEvent` from `@adatechnology/game-contracts` (it said `DamageEvent` from `game-destruction`). `game-fluids-three` paints a stain with its `tint` when it has one.
