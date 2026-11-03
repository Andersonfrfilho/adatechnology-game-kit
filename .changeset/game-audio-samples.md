---
'@adatechnology/game-audio': minor
---

Sounds from recorded files: `SampleSound` in a bank's `samples` (takes per layer: `close`, `far`, `tiers` light/medium/heavy, `tail.indoor`/`tail.outdoor`), `planSample` (round-robin without repeat, ±pitch, equal-power near/far crossover, distance and wall lowpass, pan), `engine.play` plays the files once loaded and the `fallback` recipe meanwhile, `loadSamples`, `sampleStatus`, `setEnvironment`, `PlayOptions.environment`/`intensity`, a zero-delay limiter per bus for sample voices, `choke` for rapid fire, `onVoiceStart` and `output()` for measuring. `sampleBankFromManifest` reads the manifest of `scripts/sfx-convert.mjs` (assets/sfx-inbox → Ogg Vorbis mono 48 kHz at −1 dBFS, CC0/CC-BY only, CREDITOS.md). `measureCriteria` measures C1–C9 on an OfflineAudioContext through the real engine, `recordOutput` records the output for C10, and `createSoundCheckModule` (testing) is the `sound_check_area` of the test room.
