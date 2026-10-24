# @adatechnology/game-destruction-three

## 0.3.0

### Minor Changes

- 1920f22: `DestructionRenderer.explode(point, energy, radius)` draws a blast that has no exploding part (flash, fire, smoke, light, sound and a shove on pieces in range). `world.explode` emits no event, so a grenade used to leave only debris; the test room now calls the new method when a thrown explosive detonates.

  `explode` is a new **required** member of the `DestructionRenderer` interface: any implementer of the interface (a custom renderer, a test double) must add it.

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0
  - @adatechnology/game-destruction@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0
  - @adatechnology/game-destruction@0.3.1

## 0.2.0

### Minor Changes

- 4573613: `bind` can now draw a part by a vertex range of a merged mesh: `BindOptions.parts` values also accept `{ mesh, range: [v0, v1] }` (new exported type `MeshRange`, alone or in an array with plain meshes). Dents, char and heat colours (through vertex colours), melt and hole/crack decals apply only to that range. When the part detaches, collapses (the renderer now also splits loose groups on `collapse` events) or breaks, its faces are extracted into a new mesh for the loose piece and the range is collapsed in the merged mesh; `restore` and `clear` bring everything back. Invalid ranges throw from `bind`.

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [463c9cc]
- Updated dependencies [5603151]
- Updated dependencies [d913ace]
  - @adatechnology/game-contracts@0.2.0
  - @adatechnology/game-destruction@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [cbcbd82]
  - @adatechnology/game-destruction@0.2.0

## 0.1.1

### Patch Changes

- cb132c2: `userData.destructionPart` may be a string or an object `{ id, material?, parent?, kind? }` in `specFromObject3D` and `bind`; `parent` + `kind` add an explicit joint.
- 308a258: Tall thin pieces (a door off a fridge) now topple instead of balancing on an edge: a narrow support gets a topple push and the piece does not sleep until it rests on a stable support.
- 2363a12: Fragments and debris of vertex-coloured meshes use the average vertex colour (cached per mesh) times `material.color` instead of coming out white.
- Updated dependencies [930b9ab]
- Updated dependencies [745e342]
- Updated dependencies [cc23a66]
- Updated dependencies [d727a0c]
- Updated dependencies [f1e3349]
- Updated dependencies [fd82f4a]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1
  - @adatechnology/game-destruction@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 0256a5b: Initial release (0.1.0): three.js renderer for `@adatechnology/game-destruction` with vertex dents, hole and crack decals, char and heat glow, melting and puddles, fragments, loose pieces with light physics and pooled particles, plus `specFromObject3D` and `heatColor`.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [5feff74]
  - @adatechnology/game-contracts@0.1.0
  - @adatechnology/game-destruction@0.1.0
