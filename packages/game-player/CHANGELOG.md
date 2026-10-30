# @adatechnology/game-player

## 0.3.0

### Minor Changes

- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0

## 0.2.4

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.2.3

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.2.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.2.1

### Patch Changes

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.2.0

### Minor Changes

- e6452f5: New package: the player's body (spec 001, T8.3), a literal port of the team game's player. `createPlayer` gives vitals from an attribute sheet (derived values as data),
  stamina, wounds that bleed and the bandage, the grab with six pushes or the knife, knock-downs, low-wall vaults, footstep noise, panic, the shove and the melee blow against
  any crowd (`PlayerCrowd`), and an optional individual infection (off by default: the normal world first). Every number has its source in `defaults.json`; the golden
  `game-player.json` (18 scripted runs of the game code) is replayed frame by frame. `createPlayerTestModule` is the `player_area` bench; texts in `en` and `pt-BR`; global `GamePlayer`.
