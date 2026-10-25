---
"@adatechnology/game-contracts": minor
"@adatechnology/game-destruction": minor
"@adatechnology/game-destruction-three": patch
---

`DestructionWorld.vent(objectId, partId, { point?, normal?, diameter? })` opens a through opening in a container part like a valve does (a `leak` event, the level drops, no damage and no `hole` event; `Hole.vent` marks it) and `seal` closes it. A `heat` hit of 470 °C or more on a part that leaks flammable fluid lights the leak (a lighter or a torch held at a gas jet): it burns, or goes off by its `explodes.chain`. The renderer ends a leak when its opening is closed.
