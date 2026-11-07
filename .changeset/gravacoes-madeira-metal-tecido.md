---
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction-three': minor
---

Recorded wood splinters (by blow strength), axe and blade hits on wood, metal clangs, scrapes and pings, cloth rips and cloth thumps (by strength) replace the synthesized recipes of those impacts: 44 CC0 takes from Freesound, credited in `assets/sfx/CREDITOS.md`. `splinter`, `shot_wood`, `shot_metal`, `break_wood`, `impact_soft_blunt` and `break_fabric` are keys of the impact table now, and a blow sends its strength (`intensity`) so the light, medium or heavy take plays. The recipes of the same ids stay as the fallback while a file decodes.
