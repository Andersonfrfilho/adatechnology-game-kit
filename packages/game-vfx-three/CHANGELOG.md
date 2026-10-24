# @adatechnology/game-vfx-three

## 0.1.2

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-vfx@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-vfx@0.1.1

## 0.1.0

### Minor Changes

- 51d16d1: New package `game-vfx-three` (T5.1d): the three.js renderer of the Explosion Lab. `createVfxRenderer(THREE, { scene, camera, vfx, overlay })` draws a `VfxWorld` with the Lab's shaders (puffs with the heat ramp and dissolve, streaked shrapnel, halos, shock shell and ground ring; verbatim, with the r160 `colorspace_fragment` chunk), debris with embers, blast and fire lights, scorch, dirt, rim rock and blood marks that conform to the ground as it was when they were made, and the screen overlay (flash, white, red edge, sides, gas). It implements `EffectSink` (`play`, `stop`, `configure`, `stats`, `catalog`) and `applyCamera()` shakes the camera around the render. `createGroundPatch` is the Lab's 60 m deformable patch. `game-vfx` gains `onMarks`, `fires()`, `randomState()`, a `trace` option that hears every spawn in order, and `colorOfChunk`.
- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).
- 6aa11f1: The effects bench (T5.2d, spec 001). `game-vfx-three` draws the Workshop pools (soft-point sprites with the page's shader, streaks, instanced debris, wet and dry decals, rings, flash and fire lights) when the first recipe plays, merges the Workshop screen into the overlay, understands `configure({ quality, layer_<id> })` and exports `createVfxTestModule({ locale })` (id `vfx`, group `effects`): explosion or recipe by group, variant, replay, auto replay, distance, LOD band, quality, six layers, counters against the budget and a sheet with a timeline. `game-test-room` implements the contracts the bench needs: `ModuleBench.sheet` (a card with facts, steps, swatches and a timeline whose playhead follows a module metric), `ChoiceOption.group` (`optgroup`; grouped options never become buttons) and a numeric `MetricRow.value`.

### Patch Changes

- 4415620: `createVfxRenderer` follows the camera also in `play`, so an effect played before the first `update` gets the right LOD. The Lab's 16 scenes are checked against a recording of the page (`game-vfx` pure, `game-vfx-three` scene hash).
- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

- Updated dependencies [cb85470]
- Updated dependencies [3f89fd3]
- Updated dependencies [55037ce]
- Updated dependencies [51d16d1]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
