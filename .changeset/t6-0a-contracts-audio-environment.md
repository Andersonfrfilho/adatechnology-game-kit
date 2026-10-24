---
'@adatechnology/game-contracts': minor
---

Sound and weather contracts, additive and generic. `AudioSink` (`play(SoundRequest)`, `stop`, optional `loop`, `setListener`, `register`) and `ModuleHost.audio?`; `EnvironmentState` (rain in mm/h, wind, fog, visibility, night factor, temperature, wetness), `EnvironmentBus` (`get`, `set`, `on`), `createEnvironmentBus` and `DEFAULT_ENVIRONMENT` (the calm dry day), and `ModuleHost.environment?`. A module that makes sound or reacts to the weather uses what the host lends and works without it.
