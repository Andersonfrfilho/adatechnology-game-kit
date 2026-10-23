# @adatechnology/game-fluids

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- e51b909: Initial release (0.1.0): renderer-free liquids with containers (level, tilt, temperature, fill, pour, drink, spill, leak through holes), ballistic streams, and stains that grow from a flow front, run downhill, soak and dry from the edge. 19 built-in liquids, scripted item uses (sip, drink, chug, pour, pour_out, open, close), deterministic seeded simulation with serialize/load, and an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
  - @adatechnology/game-contracts@0.1.0
