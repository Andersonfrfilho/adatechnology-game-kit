---
'@adatechnology/game-weapons': patch
'@adatechnology/game-weapons-three': minor
---

Gunshot sound from the team game: `computeShotSound` (pure, no WebAudio) gives the sound class, gain, cutoff and duration from the calibre energy, the distance, a suppressor and indoors, using the game's class table and its distance muffling (`gain / (1 + d² × 0.004)`, `cutoff / (1 + d × 0.01)`, silent under 0.01). The game calibres sound exactly as in the game; the energy scales loudness, length and brightness around the class. Classes, curves, class picker and mechanical sounds are options of `createWeaponAudio(volume, options)`, and the noise is seeded (`seed`), so the same seed gives the same sound.

New: `WeaponAudio.shotSound`, `mechanical(id)` (every `RELOAD_STAGES` id, `dry_fire`, `jam`, `safety_on`/`safety_off`, `clear_start`/`clear_end`...), `event(weaponEvent)`, `play(soundClass, volume, distance)`; `shot(energyJ, category, extras?)` takes the distance, suppressor and indoors. `game-weapons` exports `createRng`.
