---
'@adatechnology/game-vfx': minor
'@adatechnology/game-vfx-three': minor
'@adatechnology/game-terrain': minor
'@adatechnology/game-terrain-three': minor
'@adatechnology/game-weapons': minor
'@adatechnology/game-test-room': minor
---

Water splashes by weapon and by charge: `createWaterEffects` (game-vfx) with a profile per class of round (pistol, rifle, battle rifle, sniper, buckshot, slug...) and per explosive (TNT and kind), ricochet off grazing shots, trails of bubbles, columns, domes, shock rings, waves that push what floats, rain of drops, mist and foam, all with lives and pool limits; `createWaterEffectsLayer` (game-vfx-three) draws them instanced. A `pond` ground 1.4 m deep (game-terrain) in the ground area; impact-fuzed rounds go off on the water and thrown charges sink (`ExplosiveBody.isTriggeredBy`); the test room splashes every shot where it crosses water, skips grazing ones off it, draws blasts under or over water (no fireball under it) and adds `blastAt(explosive, point)`.
