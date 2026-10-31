# @adatechnology/game-crowd

## 0.2.6

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-characters@0.2.5

## 0.2.5

### Patch Changes

- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-characters@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-characters@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-characters@0.2.2

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-characters@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [95691ff]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [15c5da6]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [4ecaa9f]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-characters@0.2.0

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
