# @adatechnology/game-audio

## 0.1.0

### Minor Changes

- 0f9e616: The WebAudio layer and the bench. `createAudioEngine` (lazy context with unlock, seeded noise buffer and reverb impulse, `play`, `plan`, `loop`, `channel`, mix profiles, buses with `level(bus)` meters, `setMaster`, voice limiter), `createAudioSink` (the `AudioSink` of the contracts, carrying its engine), the `weapon` build order, `to: 'from'` and `{ from }` without a ramp, and the traces of the teams' code reproduced node for node. `createAudioTestModule` is the sound area of the test room (any sound at a distance and bearing, loops, a storm of voices, mix chain and layers, bus levels, the resolved plan), written against the generic contracts only; `BENCH_BANK` holds its two probe sounds.
- 3a8cc95: Initial release (0.1.0): sound as data. Recipes (layers of seeded noise, oscillators, formant voices, serial or parallel filters, LFOs and an envelope, with `sources` for every number) are planned by `planSound` into a `SoundPlan` with every number drawn from a seeded stream in the order the recipe is written. The teams' distance curves (`DISTANCE_CURVES`: the game's 0.004 / 0.006 / 0.01 / 0.002 and its cutoff muffling, the art scene's 0.008, the animals' linear 70 m), the art scene's stereo pan, optional occlusion, a voice limiter (groups with concurrency, cooldown and distance; a global cap of 32 that drops the lowest `priority × gain`), loop state with the game's start threshold and smoothing, mixing profiles and a sound registry with register, patch and remove. `ESM` plus the `GameAudio` global. Shipped data with `sources`: the game's 12 noise classes and fallback (`game-sfx.json`, `noiseClassRecipe`), the two team mixing profiles (`game` and `art_scene`, the kit default), the `undead_voice` group, and a temporary library (motor, rotor, horde, horn, radio static, siren) until their packages exist.

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
