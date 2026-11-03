---
'@adatechnology/game-contracts': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-vehicles': minor
'@adatechnology/game-vehicles-three': minor
---

A shut car keeps the smoke out. The contracts get `Enclosure` and `EffectSink.enclose`: a closed space (a turned box with openings and a leak) that the
host's smoke, dust, steam and gas go round. `game-vfx` holds them out in all three particle systems (`VfxWorld.enclose`: the puffs of blasts and
fires, the carried sprite kinds `smoke`, `dust`, `steam` and `ash`, and the Workshop's light sprites); they cross a wall only through an opening,
a bullet hole at its small rate, or the leak of the gaps, and what starts inside stays inside. `game-vehicles` gives the cabin of a car as one
(`cabinEnclosure`): shut, it only seeps; an open door or lid, a shattered window, a door, glass or roof torn off open it; a bullet hole lets a little
in at the hole, more for a bigger round. `game-vehicles-three` keeps the host told (`createCabinSmoke`) and the vehicles area uses it.
