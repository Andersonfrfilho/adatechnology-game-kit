---
'@adatechnology/game-weapons-three': minor
---

`createWeaponAudio` now runs on `@adatechnology/game-audio`: the three primitives are recipes and the WebAudio trace is the one recorded before the change. New option `engine` to play on a shared engine (the weapons area uses the one the host lends in `host.audio`), with its own random stream. The reload, dry-fire and bolt sounds of the art scene replace the SDK's clicks as the default `MECHANICAL_SOUNDS` (steps `scene_tone` and `scene_noise`). `game-audio` is a dependency.
