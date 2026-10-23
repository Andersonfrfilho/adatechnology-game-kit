# @adatechnology/game-destruction

## 0.1.1

### Patch Changes

- 745e342: Document that `state()` / `part()` return live read-only views and add `snapshot(id)`, a deep copy of the object's state.
- cc23a66: Ballistic hits now only wear the joints of the part they hit, scaled by the energy that part absorbed (a bullet that goes through transfers little), instead of opening every joint near the entry point. A joint that opens now stays listed in `state(objectId).joints` with `open: true` and `openedBy`, even after `splitGroup` moves its parts.
- d727a0c: Retune `green_wood`: an axe fells a 15 cm trunk in about 9 blows and a 30 cm trunk in about 36, a machete cuts a 3 cm branch in one, and 9 mm bullets only chip it (`damageScale.ballistic` 0.1).
- f1e3349: Slash joint wear now measures from the hit to the joint's contact region (not its centre), with a reach of max(6 cm, half the smaller part's smallest dimension), so an axe on a thick trunk next to a branch joint wears it.
- fd82f4a: `world.nearestJoint(objectId, point, maxDistance?, tool?)` takes an optional tool kind and then returns the nearest joint that tool can undo (falling back to the nearest joint of any kind only if none qualifies), so a wrench aimed at a wheel picks the hub bolt instead of the tyre clip. The test room's disassemble tool now passes its tool kind.
- 632a45a: Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.
- Updated dependencies [930b9ab]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 5feff74: Initial release (0.1.0): engine-agnostic, deterministic destruction model. Materials as data decide how parts dent, get holes, crack, shatter, splinter, crumble, tear, burn, melt and come apart at their joints; ballistic, blunt, slash, explosive, fire and heat damage; tool-based disassembly; fluid leaks; serializable world; `en` / `pt-BR` locale table. Also: structural integrity (load solver, overload cascade, directional supports, collapse, `buildFrame`) and the `DestructibleImpl` contract with `register` and `checkDestructible`.

### Patch Changes

- Updated dependencies [1691ef2]
  - @adatechnology/game-contracts@0.1.0
