# @adatechnology/game-test-room

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 82479e5: Initial release (0.1.0): a first-person three.js test room with a destructible target wall, table and shelf, tools from the arsenal, carrying and throwing, fluid items, a catalogue panel, an inspector, a behaviour log (JSON, NDJSON, text) and 21 scripted scenarios, with an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [5feff74]
- Updated dependencies [0256a5b]
- Updated dependencies [e51b909]
- Updated dependencies [b4c7f81]
- Updated dependencies [5f99ace]
  - @adatechnology/game-contracts@0.1.0
  - @adatechnology/game-destruction@0.1.0
  - @adatechnology/game-destruction-three@0.1.0
  - @adatechnology/game-weapons@0.1.0
  - @adatechnology/game-fluids@0.1.0
  - @adatechnology/game-fluids-three@0.1.0
