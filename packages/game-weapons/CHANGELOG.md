# @adatechnology/game-weapons

## 0.1.2

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [5603151]
  - @adatechnology/game-contracts@0.2.0

## 0.1.1

### Patch Changes

- 3a094cc: Add the `kick` and `shove` melee tools (pt-BR "chute" and "empurrão") to the arsenal and the default loadout; in the test room V kicks whatever tool is selected, and a `kick_detaches_leg_via_tool` scenario covers the hotbar path.
- 5954706: Add `machete` and `utility_knife` to `DEFAULT_LOADOUT`.
- Updated dependencies [930b9ab]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 5f99ace: Initial release (0.1.0): 18 real calibres and 45 generic weapon archetypes as data (firearms, melee, flame, heat, throwables, tools), a deterministic `WeaponState` runtime (magazines, fire modes, reload, spread and bloom, pellets, recoil, fuel) that produces `Shot`s and `Use`s, and an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
  - @adatechnology/game-contracts@0.1.0
