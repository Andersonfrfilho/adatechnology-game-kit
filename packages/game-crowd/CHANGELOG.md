# @adatechnology/game-crowd

## 0.2.0

### Minor Changes

- b6e8131: New package `game-crowd` (spec 001, T8.1a): any crowd as a struct of arrays, a literal port of the team game's horde (`hordeUpdate` and everything it calls).
  Relevance bands with hysteresis, perception by sight, hearing and smell, the sliced flow field, the spatial hash and separation, six attack slots, chain
  alerts, doors (`createDoors`), piles against walls, the special moves as type traits, corpses, the blood trail, the population and migrations, on the game's
  grid (`createNavGrid`). The golden `game-crowd.json` (8 scenes of the game code) is replayed frame by frame; global `GameCrowd`.
  `game-characters-undead` gives `undeadCrowdPack()` (the 13 types with the horde's numbers and traits); the corpse ledger of `game-characters` gains `remove(index)`.
- ac9fc82: Civilians, herds and flocks on the crowd (spec 001, T8.1b), literal ports of the team game: `createCivilians` (routine by the hour, fear, the group
  that follows, leaving along a path, doors, agents that hunt and bite, turning; events `bitten`, `died`, `turned`, `gone`), `createHerd` with `HERD_ROLES`
  (wander, rest, flee, the companion, the hen, the lapwing, the cow and the dog, whose calls are noises the crowd hears), `createFlock` (vultures over
  the bodies, the live map's ring of birds) and `bindInfection` (the bridge to `game-infection`: `materialize`, kills back as removed, `giveBack`, bites
  as `infect`). The goldens `game-crowd-civilians.json` and `game-crowd-herd.json` replay them with the horde frame by frame.

### Patch Changes

- Updated dependencies [b6e8131]
  - @adatechnology/game-characters@0.1.6
