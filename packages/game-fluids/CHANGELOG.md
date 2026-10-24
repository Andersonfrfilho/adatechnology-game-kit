# @adatechnology/game-fluids

## 0.2.1

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.2.0

### Minor Changes

- ba652e9: The running film of the Fluid Standard (T5.3a, spec 001): `createFilm({ layout, profile, random })`, a literal port of the page's rules (F60-114). Drops land as impacts stretched by `1 / sin(angle)` with spikes, satellites and tails; a 180 Hz thin-film step limited to the wet box (at most 6 steps per frame, or `maxSteps`) runs rivulets with a bulb at the tip, follows the slope and the joints and dries from the thin edge in. Drips, continuous sources and drag smears are included. New: `PADRAO_LAYOUT`, `WORKSHOP_LAYOUT`, `createFoldedLayout`, `layoutFromSurfaces({ floor, wall?, curb?, center })` (the fold built from the host's `SurfaceSpec`s), `FILM_PROFILES` and `filmProfileOf` (`data/film-profiles.json`: blood, old blood, bile, motor oil, fuel, with the Workshop's `spikes` and `landsAsBlob`), `createFilmLcg`, the `FilmSimulator` interface (the CPU version is the reference for a later GPU one) and `film.setWeather({ rain })` (drying stops, spread x1.5; a no-op until `game-weather` drives it). The film never calls `Math.random`: the host gives the stream, so a LAN client with the same seed gets the same film. Additive: nothing existing changes.
- 0d9cb33: The team's values as the fluids defaults (T5.3b, spec 001 decision E2). `blood`: `stainColor` `0x3B1D14` (was `0x4A0506`) and `dryTime` 600 s (was 1200). `fuel`: `dryTime` 60 s (was 120) and `leavesMark: false` (was `true`: it evaporates and leaves nothing). `water`: `dryTime` 180 s (was 600). New liquids `old_blood` (`0x6C1C16` drying to `0x2A160E`, 360 s) and `bile` (`0x8A9A2A` to `0x3E4220`, 900 s), with `en` and `pt-BR` names. A game that wants the old values replaces the liquid by id: `createFluids({ liquids: [{ ...blood, dryTime: 1200, stainColor: 0x4a0506 }] })`. New `splash(liquid, point, liters, velocity, { tint: { fresh, dry } })` colours one splash and the stain it makes or joins (`StainState.tint`, kept by `serialize` and `load`), so the age of an infection stays in the characters' data and the liquid stays generic. The README imports `DestructionEvent` from `@adatechnology/game-contracts` (it said `DamageEvent` from `game-destruction`). `game-fluids-three` paints a stain with its `tint` when it has one.

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.1.8

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.1.7

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0

## 0.1.6

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0

## 0.1.5

### Patch Changes

- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-contracts@0.5.0

## 0.1.4

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [5603151]
  - @adatechnology/game-contracts@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [930b9ab]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- e51b909: Initial release (0.1.0): renderer-free liquids with containers (level, tilt, temperature, fill, pour, drink, spill, leak through holes), ballistic streams, and stains that grow from a flow front, run downhill, soak and dry from the edge. 19 built-in liquids, scripted item uses (sip, drink, chug, pour, pour_out, open, close), deterministic seeded simulation with serialize/load, and an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
  - @adatechnology/game-contracts@0.1.0
