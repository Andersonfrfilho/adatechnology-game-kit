---
'@adatechnology/game-crowd': minor
'@adatechnology/game-characters-undead': minor
'@adatechnology/game-characters': patch
---

New package `game-crowd` (spec 001, T8.1a): any crowd as a struct of arrays, a literal port of the team game's horde (`hordeUpdate` and everything it calls).
Relevance bands with hysteresis, perception by sight, hearing and smell, the sliced flow field, the spatial hash and separation, six attack slots, chain
alerts, doors (`createDoors`), piles against walls, the special moves as type traits, corpses, the blood trail, the population and migrations, on the game's
grid (`createNavGrid`). The golden `game-crowd.json` (8 scenes of the game code) is replayed frame by frame; global `GameCrowd`.
`game-characters-undead` gives `undeadCrowdPack()` (the 13 types with the horde's numbers and traits); the corpse ledger of `game-characters` gains `remove(index)`.
