# @adatechnology/game-audio

## 0.2.0

### Minor Changes

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.1.2

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.1

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.0

### Minor Changes

- 0f9e616: The WebAudio layer and the bench. `createAudioEngine` (lazy context with unlock, seeded noise buffer and reverb impulse, `play`, `plan`, `loop`, `channel`, mix profiles, buses with `level(bus)` meters, `setMaster`, voice limiter), `createAudioSink` (the `AudioSink` of the contracts, carrying its engine), the `weapon` build order, `to: 'from'` and `{ from }` without a ramp, and the traces of the teams' code reproduced node for node. `createAudioTestModule` is the sound area of the test room (any sound at a distance and bearing, loops, a storm of voices, mix chain and layers, bus levels, the resolved plan), written against the generic contracts only; `BENCH_BANK` holds its two probe sounds.
- 3a8cc95: Initial release (0.1.0): sound as data. Recipes (layers of seeded noise, oscillators, formant voices, serial or parallel filters, LFOs and an envelope, with `sources` for every number) are planned by `planSound` into a `SoundPlan` with every number drawn from a seeded stream in the order the recipe is written. The teams' distance curves (`DISTANCE_CURVES`: the game's 0.004 / 0.006 / 0.01 / 0.002 and its cutoff muffling, the art scene's 0.008, the animals' linear 70 m), the art scene's stereo pan, optional occlusion, a voice limiter (groups with concurrency, cooldown and distance; a global cap of 32 that drops the lowest `priority × gain`), loop state with the game's start threshold and smoothing, mixing profiles and a sound registry with register, patch and remove. `ESM` plus the `GameAudio` global. Shipped data with `sources`: the game's 12 noise classes and fallback (`game-sfx.json`, `noiseClassRecipe`), the two team mixing profiles (`game` and `art_scene`, the kit default), the `undead_voice` group, and a temporary library (motor, rotor, horde, horn, radio static, siren) until their packages exist.

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
