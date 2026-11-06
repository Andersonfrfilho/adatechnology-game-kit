# @adatechnology/game-player

## 0.5.7

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0

## 0.5.6

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0

## 0.5.5

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.5.4

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.5.3

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0

## 0.5.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.5.1

### Patch Changes

- 9a151ad: `urgent` on a play (`PlayOptions`, `SoundRequest`): the voice is built at once instead of in the deferred start queue. The body's sounds use it (footsteps, jump, landing, swing, hit): at a low frame rate the queue started the hit of a knife, an axe or a bat 60 to 500 ms late, or dropped it.
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.5.0

### Minor Changes

- 15046ce: Body sounds by action and by floor. `game-contracts` names them (`footstep_<surface>_<walk|run>` on 12 surfaces, `land_<surface>_<light|heavy>`, the swing and the hit of each blow, hurt, bite, grab, body fall) with `surfaceOfMaterial` and the `footfall` host event; `game-audio` answers every id with `BODY_FOLEY_BANK` (four takes each) and adds sound sets (`SoundBank.sets`: a take that never repeats, at ±4% of rate, through `retunePlan`) and `SoundRequest.delay`; `game-player` emits the ids (`sound.ids`, the team class stays in `sound.sound`), reads the floor (`world.surfaceAt`, `input.surface`) and steps on the host's footfalls (`input.footfall`); the player body says when a heel is down (`footfall()`); the test room sends the footfalls, plays the jump and the landing on the floor under the feet, the swing just before the contact and the hit with it.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [d97cf9f]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0

## 0.4.1

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0

## 0.4.0

### Minor Changes

- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.

### Patch Changes

- 7f7dd06: A leaf left between closed and open goes the other way from where the last use sent it: a door that hit something while opening closes on the next E instead of trying to open again forever (`DoorUseTarget.lastGoal`, `DoorUseRules.endTolerance`; the room remembers the last way of each leaf). At either end the old rule holds, so a leaf put back by a reset opens.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.3.1

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0

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
