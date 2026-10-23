# @adatechnology/game-contracts

## 0.2.0

### Minor Changes

- 5603151: New part status `'collapsed'` (added to `PartStatus`). Every part that is reported in a `collapse` event and was not already broken, melted or ash gets `status: 'collapsed'` instead of staying `intact`/`damaged`; it is kept by `serialize`/`load`, cleared by `reset`, and the part becomes `broken` if it later fractures. `partStatus` locale tables gained `collapsed` (`desabado`). A collapsed part still exists as a piece, so code that treats `broken`, `melted` and `ashes` as lost needs no change; exhaustive switches over `PartStatus` need a new case.

### Patch Changes

- 4babeca: Overloaded structures now fail on a game-feel timescale. The overload damage was proportional to the excess alone (`(stress - 1) * maxHp * 0.5` per second), so a part at stress 1.02 took about 100 s to give way and a cascade of slightly overloaded columns took 30-70 s. It is now `min(0.6, 0.12 + 0.8 * (stress - 1))` of `maxHp` per second: stress 1.02 gives way in about 7 s, 1.1 in 5 s, 1.5 in 2 s and anything above 1.7 in 1.7 s (it was 0.3 s at stress 8: very high stress is slightly slower now). Still deterministic. Hosts that tuned capacities around the old timing may see structures fall sooner.

## 0.1.1

### Patch Changes

- 930b9ab: Add `checkSpec` to game-contracts; `loadModule` runs it for every item with a spec (given, a function, or derived) and logs ✓/✗/⚠ lines.
- 632a45a: Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
