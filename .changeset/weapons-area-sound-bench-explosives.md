---
'@adatechnology/game-weapons-three': minor
---

The weapons area finishes Phase 1. The weapon in the hands and the area play the shot sound from the calibre (energy and the distance from the listener, `computeShotSound`)
and the mechanical sounds of the rule events through `mechanicalSoundOf` (reload stages, cycle, jam, clear, safety, dry fire, misfire); an `explosion` host event plays the
game class by the distance from the camera. The bench of the module: layers `muzzle_flash`, `casings`, `magazines`; controls `condition` (rule and materials), `ammo_quality`
and `sound_distance`; metrics `casings_live`, `magazines_live` and `heat` (max 100). Each generic archetype wears the model of the first brand weapon (lowest id) that points
to it and fires the same way (`ARCHETYPE_MODELS`); melee, bow and throwables keep the simple prop. The area gets a fuel barrel, a propane cylinder and a car fuel tank in the
east corner (`worldExplosiveItem`, with `explodes.chain` from the explosive data), so a bullet starts the chain reaction.
