---
'@adatechnology/game-audio': minor
'@adatechnology/game-test-room': minor
---

Sound occlusion: `createAudioEngine({ occlusion: { query } })` asks the host what lies between a sound and the ears (material and thickness, or a loss in dB), adds the transmission loss of the hits (`TRANSMISSION_LOSS`, a table of real values a game patches: 12 cm brick about 42 dB, concrete 48, drywall 33, wooden door 22, glass 27, open doorway 0, the mass law for other thicknesses) up to a configurable cap so a sound that gets around an edge never drops to silence, and plays each positioned voice through its own gain and lowpass (highs lose more). Voices are re-queried as the listener moves, at a limited rate and within a per-update budget, only while audible, and the gain and cutoff glide with `setTargetAtTime`. `occludedVoices()` reports the numbers. The old `(point) => 0..1` callback still works. The test room hands its engine a query that crosses its destruction world (`createWorldOcclusion`): the part's material, and its thickness from the way in and the way out.
