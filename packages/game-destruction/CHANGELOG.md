# @adatechnology/game-destruction

## 0.6.0

### Minor Changes

- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.5.0

### Minor Changes

- 9e58b50: Contratos de parede em camadas e estágios de dano (todos opcionais): `PartSpec.layers` (`SurfaceLayer`), `reinforcement` (`Reinforcement`), `units` (`PartUnits`) e `breach` (`PartBreach`); `PartState.stage` (`DamageStage` 0 a 3), `stripped` e `opening`; `Fragment.marks` (`FragmentMark`); eventos `spall`, `stage` (com `opening` e `fragments`) e `expose`. `checkSpec` valida os campos novos. Módulos existentes compilam sem mudança.
- 95c4bdd: Paredes em camadas, estágios e armadura. Registro de montagens (`ASSEMBLIES`, `registerAssembly`, `assemblyPart`) com as 8 paredes de medida real (tijolo rebocado, bloco, concreto armado, drywall, madeira, tronco, chapa e vidro). Penetração soma `penetration x espessura` de cada camada, a camada de fora lasca primeiro (`spall`). Estágios 0 a 3 com brecha (0,25 m² dentro de 0,55 m: fragmentos do tamanho da peça, abertura, a peça fica; `stage`), gaiola de armadura (`expose`, `stripped`, capacidade residual, colapso progressivo por sobrecarga, corte com maçarico ou serra) e furos que ficam nos fragmentos (`Fragment.marks`). `sizeStructure` ganha `redundancyRoles` e `safetyByRole`. `DestructionOptions.breach` (`radius`, `blastFactor`). Goldens próprios em Node 22 e 24 (`@adatechnology/golden-tool` como devDependency).

### Patch Changes

- 76d15b6: Contrato do corpo vivo (fase 4): `body.ts` com `BodySlot`, `SegmentKind`, `BodyRegion` e `MISSING_BITS`; `Hit.mass`, `Hit.cut` e `Hit.part`; evento `body`; `ObjectState.body`. `Shot.mass` (gramas do projétil) sai das armas e `shotToHit` copia para o `Hit`. O `game-destruction` ganha o rótulo do evento `body` nos dois idiomas.
- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0

## 0.4.2

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0

## 0.4.1

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0

## 0.4.0

### Minor Changes

- 76ae86f: Chain reaction of explosives (A11). A part with `explodes.chain` is set off by a bullet, fire or a blast within reach and explodes after the delay of that trigger (fixed or drawn from the seed); the world emits `primed` and then `explode`, a part goes off once, blasts resolve in order of time and the delays count from the blast that armed the part, so the timeline does not depend on the `dt` of `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `game-weapons` (fuel barrel, car tank, propane, pump, station tank). A bullet or a blast that would have destroyed such a part now arms it instead. `game-destruction-three` draws the fire of a part primed by a shot or fire.

### Patch Changes

- 04929d4: A call that sets off many parts at once (a blast that fails more than 64 charges) now resolves every blast it queued before returning, instead of leaving the rest for the next call and shifting their effects in time. The loop ends because a part goes off once and is primed once.
- Updated dependencies [d10c7f7]
- Updated dependencies [a569662]
- Updated dependencies [b3a5d99]
- Updated dependencies [9666008]
- Updated dependencies [9666008]
- Updated dependencies [f4da1a6]
- Updated dependencies [c0fcb62]
- Updated dependencies [85ac930]
  - @adatechnology/game-contracts@0.5.0

## 0.3.2

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0

## 0.3.0

### Minor Changes

- 4babeca: Overloaded structures now fail on a game-feel timescale. The overload damage was proportional to the excess alone (`(stress - 1) * maxHp * 0.5` per second), so a part at stress 1.02 took about 100 s to give way and a cascade of slightly overloaded columns took 30-70 s. It is now `min(0.6, 0.12 + 0.8 * (stress - 1))` of `maxHp` per second: stress 1.02 gives way in about 7 s, 1.1 in 5 s, 1.5 in 2 s and anything above 1.7 in 1.7 s (it was 0.3 s at stress 8: very high stress is slightly slower now). Still deterministic. Hosts that tuned capacities around the old timing may see structures fall sooner.
- 463c9cc: Thin brittle shells that shatter now break on the first bullet. For materials with `fracture: 'shatter'` (glass, ceramic) ballistic damage is multiplied by the same `fragility(ductility, thickness)` factor that blunt hits already used: a 9 mm (about 500 J) now shatters a 4-6 mm window pane in one shot (a 5 kg pane took 6 before), a 2 cm glass block takes 4 (15 before) and a 5 cm block 8 (38 before). Ductile materials, shells 2 cm or thicker (factor up to x4.7 only for glass) and `crumble` materials such as tempered glass are unchanged apart from the thickness term. The test room scenario `glass_shatters` now expects the first shot.
- 5603151: New part status `'collapsed'` (added to `PartStatus`). Every part that is reported in a `collapse` event and was not already broken, melted or ash gets `status: 'collapsed'` instead of staying `intact`/`damaged`; it is kept by `serialize`/`load`, cleared by `reset`, and the part becomes `broken` if it later fractures. `partStatus` locale tables gained `collapsed` (`desabado`). A collapsed part still exists as a piece, so code that treats `broken`, `melted` and `ashes` as lost needs no change; exhaustive switches over `PartStatus` need a new case.
- d913ace: New `sizeStructure(spec, { safety?, redundancy? })`: runs the world's own load solver on the intact spec and returns a copy where every structural part has `structure.capacity` set so its at-rest stress equals `safety` (default 0.65). With `redundancy` (for example 0.97) capacities are raised so that losing any single column keeps every other part at or below that stress (N-1 design). Parts without `structure` are left unchanged. Replaces hand-calibrated capacities.

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [5603151]
  - @adatechnology/game-contracts@0.2.0

## 0.2.0

### Minor Changes

- cbcbd82: Slash (blade) damage now follows the part's cross-section instead of its whole mass. A cut only goes through a slice of the part, so on a part longer than 1 m slash damage is multiplied by its longest dimension in metres (at most 50): a 6.8 m trunk costs as much to cut as a 1 m log of the same diameter, and cutting effort grows with the section area. Parts up to 1 m long are unchanged. A long trunk no longer takes thousands of axe blows. Blunt, ballistic, explosive and fire damage and joint wear are unchanged. Hosts that tuned slash damage on parts longer than 1 m (trunks, beams, poles) may need to retune.

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
