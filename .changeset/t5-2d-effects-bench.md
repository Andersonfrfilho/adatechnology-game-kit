---
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-test-room': minor
---

The effects bench (T5.2d, spec 001). `game-vfx-three` draws the Workshop pools (soft-point sprites with the page's shader, streaks, instanced debris, wet and dry decals, rings, flash and fire lights) when the first recipe plays, merges the Workshop screen into the overlay, understands `configure({ quality, layer_<id> })` and exports `createVfxTestModule({ locale })` (id `vfx`, group `effects`): explosion or recipe by group, variant, replay, auto replay, distance, LOD band, quality, six layers, counters against the budget and a sheet with a timeline. `game-test-room` implements the contracts the bench needs: `ModuleBench.sheet` (a card with facts, steps, swatches and a timeline whose playhead follows a module metric), `ChoiceOption.group` (`optgroup`; grouped options never become buttons) and a numeric `MetricRow.value`.
