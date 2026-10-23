# @adatechnology/game-test-room

## 0.1.2

### Patch Changes

- Updated dependencies [cbcbd82]
  - @adatechnology/game-destruction@0.2.0
  - @adatechnology/game-destruction-three@0.1.2

## 0.1.1

### Patch Changes

- 930b9ab: Add `checkSpec` to game-contracts; `loadModule` runs it for every item with a spec (given, a function, or derived) and logs ✓/✗/⚠ lines.
- 3a094cc: Add the `kick` and `shove` melee tools (pt-BR "chute" and "empurrão") to the arsenal and the default loadout; in the test room V kicks whatever tool is selected, and a `kick_detaches_leg_via_tool` scenario covers the hotbar path.
- fd82f4a: `world.nearestJoint(objectId, point, maxDistance?, tool?)` takes an optional tool kind and then returns the nearest joint that tool can undo (falling back to the nearest joint of any kind only if none qualifies), so a wrench aimed at a wheel picks the hub bolt instead of the tyre clip. The test room's disassemble tool now passes its tool kind.
- 632a45a: Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.
- 9275cc1: `log.download` now works inside a claude.ai Artifact through the `downloads` capability (declined saves are logged as `export_cancelled`), and "Copy JSON" falls back to a selected textarea without `navigator.clipboard`.
- d6c453a: Add `room.pause()` / `room.resume()` / `room.paused` (the simulation stops, the UI and log stay) and `room.walk(to, seconds)` to walk the player along a straight line during subsequent steps and frames.
- Updated dependencies [930b9ab]
- Updated dependencies [cb132c2]
- Updated dependencies [745e342]
- Updated dependencies [cc23a66]
- Updated dependencies [d727a0c]
- Updated dependencies [f1e3349]
- Updated dependencies [3a094cc]
- Updated dependencies [5954706]
- Updated dependencies [fd82f4a]
- Updated dependencies [632a45a]
- Updated dependencies [308a258]
- Updated dependencies [2363a12]
  - @adatechnology/game-contracts@0.1.1
  - @adatechnology/game-destruction-three@0.1.1
  - @adatechnology/game-destruction@0.1.1
  - @adatechnology/game-weapons@0.1.1
  - @adatechnology/game-fluids@0.1.1
  - @adatechnology/game-fluids-three@0.1.1

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
