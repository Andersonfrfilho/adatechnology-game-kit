---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

Fire sounds by fuel: wood, fabric, plastic/rubber, a gas jet and a pool of fuel each play their own roar (`FIRE_FUEL_OF`, `FIRE_LOOP_OF`, `FIRE_CRACKLE_OF`, recorded loops with synthesized fallbacks); a gas jet and a fuel pool do not crackle. The renderer sends the burning material, a venting vessel burns as gas until it bursts, and `DestructionSound.reset()` puts every fire sound out. The test room gives a molotov's pool and a burning fuel stain the liquid fire sound and resets the fires on clear.
