# @adatechnology/game-crowd

## 0.5.0

### Minor Changes

- 99183cb: Pushing, as in the real world. A pushed piece that meets a loose one shoves it along when the legs beat the frictions of the whole row (`canPush`, `pushSpeedFor` and `pushAccelerationFor` take a row; `FurniturePush.setLoad`), and locks when they do not. Dragging scratches the floor by its material (`dragMarks` in `FurniturePushRules`, `dragMarkFor`): wood and tile scratch, concrete scuffs, dirt and sand furrow, carpet and grass keep no mark; the scratch is a persistent `scrape` mark of `game-vfx` (`VfxWorld.scrape`, at most `SCRAPE_LIMIT`, the oldest leaving first), drawn instanced by `game-vfx-three`. Civilians walk round a piece of furniture along its face instead of shoving it (`crowd.movableAt`, `bodyRadius`), and `flee` starts its own stuck count. A liquid spilled on a table top goes with the pushed table (`FluidWorld.moveSurface`). `world.sweepBox` ignores a list of objects.
- 1dea1ac: Pushing furniture with what rests on it, and being shoved by a horde. The push now speeds up as a person does (`accel` in `FurniturePushRules`: the force left over the friction over the mass, at most 1.5 m/s², braking at 3 m/s²), so a cup on a pushed table rides along, and a sudden stop (the piece hits something, or the player lets go) throws what rests on it forward with the speed it had (`slipsOnTop`, `frictionFor`, `pushAccelerationFor`; each step reports `velocity`, `acceleration` and `stoppedFrom`). The agents of a crowd stop at the faces of the host's movable furniture (`crowd.setMovables`), lean their force on it with the arms out and the body forward (`numbers.shoveForce`, the look's `shoveLean`), and their forces add up (`crowd.shoves`); the host moves the piece at the speed that force gives it (`ModuleHost.movables` and `ModuleHost.shove`). The test room's table is pushable, carries what rests on its top and adds its mass to the push; a module's bodies shove what the player can push, a piece too heavy for one of them moves for three, and a shoved piece stops at the player. The crowd bench has a `furniture_shove` scene.

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-characters@0.2.17

## 0.4.7

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-characters@0.2.16

## 0.4.6

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-characters@0.2.15

## 0.4.5

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-characters@0.2.14

## 0.4.4

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-characters@0.2.13

## 0.4.3

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-characters@0.2.12

## 0.4.2

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-characters@0.2.11

## 0.4.1

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-characters@0.2.10

## 0.4.0

### Minor Changes

- a27d5ae: A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-characters@0.2.9

## 0.3.0

### Minor Changes

- 81af508: The default walk cadence range of the personality is 0.85 to 1.15 (it was 0.88 to 1.12), so a group of nine neighbours differs in step by a coefficient of variation of 0.056. A crowd with `personality` on and no explicit `cadence` walks differently from before; pass `cadence: [0.88, 1.12]` for the old numbers.
- 302a2dc: A dense horde with physics, off by default and then the horde of the game bit for bit: bodies that push each other (inelastic impulse and a position correction that never adds energy), a pressure field that moves one hop per fixed step (a file of N agents against a wall gives its front N times the drive), a balance machine (standing, staggering, fallen, getting up, thrown) with the critical pressure of each body, trips and collapses, a mound of lying bodies that others climb and trample, doors broken by the pressure in discrete blows, `crowd.blast(...)` resolved in one pass over the agents with the shove of `game-contracts`, a pool of thrown bodies simulated here (`thrown.priority` `mixed`, `fastest` or `nearest`), personality by seed (speed, reaction, stability, trip, drive, cadence, aggression, gait, idle) and an optional pressure of the horde on the player through `knock` and `hurt`. Everything uses a counter-based draw (`unit(identity, step, salt)`) and never the shared random stream, so the same seed gives the same result at 30, 60 and 144 frames per second. `CrowdUpdateContext.bandCentre` and `CrowdOptions.flow.cellsPerStep` are new; `CROWD_PHYSICS_DEFAULTS` turns everything on. `physics.worker` (`'off'` | `'auto'` | `'on'`, with `workerTransport`, `workerLatency` and `workerFactory`) runs the contact and the pressure in a worker one step behind (a `SharedArrayBuffer` frame, or a transferred one without cross-origin isolation); the answer is byte for byte what the same step gives on the main thread. `attachPhysicsWorker`, `crowd.dispose()` and `dist/physics-worker.js` are new. `physics.density` summarises band R1 without pairs: a coarse grid of 2 m counts the walkers, above 4 bodies per cell the speed falls by `capacity / bodies` and the field is `(bodies − 4) · 150` N.

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
  - @adatechnology/game-characters@0.2.8

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
