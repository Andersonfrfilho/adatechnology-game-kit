---
'@adatechnology/game-audio': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

Synthesized sounds measured from the recordings. `@adatechnology/game-audio/fitted` holds the fitted copy of every recorded sound but the vehicles (band gain curves and ringing partials per take, measured by `tools/sfx-sources/fit.mjs`), and `registerFittedSounds(engine)` puts them in place of the older hand-made recipes of the same ids, so a door, a shot or a footstep stays close to its recording where the files are missing or still loading. The test room registers them; the weapons play the fitted shot, reload step and case under the recorded id (`played.kind === 'fitted'`) instead of the synthesized layers until the files load.

The kit ships its default recorded sounds again: the 1050 CC0 and CC-BY takes in `@adatechnology/game-audio/assets/sfx/<categoria>/` (credits in `CREDITOS.md`), and `pointSamples(engine, files, { baseUrl })` lets a game play its own files for any id (the id keeps the kit's numbers) without touching the kit. Git takes only the manifest's CC0 and CC-BY files there.
