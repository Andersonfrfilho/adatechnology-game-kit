# @adatechnology/game-destruction-three

## 0.7.2

### Patch Changes

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).
- Updated dependencies [a41fcb7]
- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-audio@0.1.2
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-vfx@0.1.3
  - @adatechnology/game-vfx-three@0.1.3

## 0.7.0

### Minor Changes

- 968d7df: `renderer.explode(point, energy, radius, { report })` pushes each piece with the energy that reached its object (shelter and confinement of the `world.explode` results); without a report the old formula.

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction@0.7.0
  - @adatechnology/game-audio@0.1.1
  - @adatechnology/game-vfx@0.1.2
  - @adatechnology/game-vfx-three@0.1.2

## 0.6.0

### Minor Changes

- 0f9e616: `createDestructionSound(engine)` registers the material sounds of the art scene (`glass`, `wood`, `thunk`, `ping`, `clang`, `chip`, `crumble`, `thud`, `hiss`, `boom`, `burst`, `crack`) and the game's `explosion_boom` in `@adatechnology/game-audio`, and maps the renderer's `onSound` keys through a replaceable table (`art_scene` or `game` style). The renderer sends `burn_end` when a part goes out or finishes burning, and `burn_loop` is the fire loop that rises with the parts in flames. `game-audio` is a dependency.

### Patch Changes

- Updated dependencies [7fd46fb]
- Updated dependencies [0f9e616]
- Updated dependencies [3a8cc95]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-audio@0.1.0
  - @adatechnology/game-destruction@0.6.1
  - @adatechnology/game-vfx@0.1.1
  - @adatechnology/game-vfx-three@0.1.1

## 0.5.0

### Minor Changes

- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [3f89fd3]
- Updated dependencies [55037ce]
- Updated dependencies [51d16d1]
- Updated dependencies [4415620]
- Updated dependencies [aa2c014]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
  - @adatechnology/game-vfx-three@0.1.0
  - @adatechnology/game-destruction@0.6.0

## 0.4.0

### Minor Changes

- 86179cc: Desenha os eventos de parede: `spall` (remendo da cor do núcleo), `stage` 2 (fragmentos do tamanho da peça com os furos de `Fragment.marks` presos neles, a peça continua desenhada) e `expose` (vergalhão em cilindros instanciados, `renderer.rebarCount()`). A abertura cortada na malha fica para o renderizador de casas.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-destruction@0.5.0

## 0.3.3

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0
  - @adatechnology/game-destruction@0.4.2

## 0.3.2

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0
  - @adatechnology/game-destruction@0.4.1

## 0.3.1

### Patch Changes

- 76ae86f: Chain reaction of explosives (A11). A part with `explodes.chain` is set off by a bullet, fire or a blast within reach and explodes after the delay of that trigger (fixed or drawn from the seed); the world emits `primed` and then `explode`, a part goes off once, blasts resolve in order of time and the delays count from the blast that armed the part, so the timeline does not depend on the `dt` of `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `game-weapons` (fuel barrel, car tank, propane, pump, station tank). A bullet or a blast that would have destroyed such a part now arms it instead. `game-destruction-three` draws the fire of a part primed by a shot or fire.
- Updated dependencies [04929d4]
- Updated dependencies [76ae86f]
- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-destruction@0.4.0
  - @adatechnology/game-contracts@0.5.0

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
