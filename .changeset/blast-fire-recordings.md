---
'@adatechnology/game-audio': patch
'@adatechnology/game-destruction-three': minor
---

Recorded blasts and fire (Freesound CC0 field recordings) for the explosion and fire sounds: `blastFireSampleBank` and `BLAST_FIRE_SAMPLES` in game-destruction-three play the files under the same ids as the synthesized recipes, which stay as the fallback; the fire's roar is a crossfaded loop of recorded fires. game-audio: a looping sample sound now plays at its own `gain`, and `sfx:convert` drops manifest takes whose file is gone.
