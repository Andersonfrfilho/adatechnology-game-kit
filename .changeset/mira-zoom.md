---
'@adatechnology/game-weapons': minor
'@adatechnology/game-weapons-three': minor
---

Every gun closes the view in when it aims, not only one with a scope. `rules.aim.ironSightZoom` gives the iron-sight zoom of each weapon category (1.1x for a handgun up to 1.4x for a marksman or sniper rifle with no optic) and `aimZoomOf(arsenal, weapon, attachments)` answers the zoom of a weapon: the optic fitted (the AUG's integral 1.5x, an ACOG 4x), else the iron sights of its category. The right mouse button of the weapons area aims every firearm and launcher by it.
