---
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-weapons-three': minor
'@adatechnology/game-test-room': minor
---

Recorded sounds for the grenade launcher and the rocket: 33 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `launcher_40mm` (the 40 mm thunk of the M79, M32 and M203) and `rocket_launch` (an RPG-7 firing, three shots cut from one field recording, and more) are played by `WeaponAudio.launch`; the break-open reload (`barrels_open` and `barrels_close`, the hinged barrels of the M79 and of the break-action shotguns, which share the cue; `breech_open`, `grenade_load` and `breech_close`, the breech of a rocket launcher) and the rocket loading (`rocket_load`, `rocket_seat`) are the cues of the reload clips, whose hits are measured in `reload-sample-hits.json`; `explosion_rocket` is the blast of the rocket family; `rocket_motor_loop` is the motor of a rocket in flight, which the test room plays as one loop that follows the rockets in the air (`ROCKET_MOTOR`) and stops when the last one has burst. The recipes of the same ids stay as the fallback while a file decodes (the motor has a new one, `ROCKET_MOTOR_LOOP`).
