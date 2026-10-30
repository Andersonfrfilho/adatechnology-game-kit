# @adatechnology/game-destruction

## 0.10.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0

## 0.9.0

### Minor Changes

- bf68a04: A shot book tears into loose pages instead of slabs as thick as the book. New `MaterialDef.sheet` (thickness of one sheet; paper 1 mm): a `tear` part thicker than a few sheets comes apart as layers of thin scraps, a little askew, three in four marked `Fragment.inner` (pages) and the rest cover. New `visual.innerColor` (paper: cream) colours the inner scraps and the fibres a hit throws out. The renderer lets those thin scraps glide and flutter down before they settle flat.

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0

## 0.8.2

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0

## 0.8.1

### Patch Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.

## 0.8.0

### Minor Changes

- 1331018: An explosive part can carry `explodes.lethalRadius` (and a blast `Hit` its `lethalRadius`; the `explode` event repeats it). A character inside it takes the whole blast, between it and `radius` it takes at most `blast.injuryPoints` (default 15 per segment) falling off to nothing at `radius`, so it is hurt but not killed. Without `lethalRadius` the blast is the old one: points fall off over `radius`.
- 5b1d53f: `DestructionWorld.vent(objectId, partId, { point?, normal?, diameter? })` opens a through opening in a container part like a valve does (a `leak` event, the level drops, no damage and no `hole` event; `Hole.vent` marks it) and `seal` closes it. A `heat` hit of 470 °C or more on a part that leaks flammable fluid lights the leak (a lighter or a torch held at a gas jet): it burns, or goes off by its `explodes.chain`. The renderer ends a leak when its opening is closed.
- 1b1d611: Per-caliber penetration table in `game-weapons` (`AMMO`, 50 loads, `arsenal.loadOf`, `weapon.setAmmoKind`, `ArsenalOptions.ammo`): per calibre and kind of round
  (fmj, hp, ap, buck, slug, birdshot, incendiary, tracer...) the core and jacket, the mass and speed when they differ, the energy and the millimetres of steel,
  concrete, brick and wood it goes through. The shot carries `ammo`, `penetration`, `incendiary` and `tracer`. `game-contracts`: `Hit.penetration`, `Hit.incendiary`,
  `Hit.tracer`, `Hit.ignition`, `shotExtras(shot, distance)` (the penetration scaled by the energy left) and `shotToHit` passes them. `game-destruction` reads
  `Hit.penetration` by material class (`MaterialDef.penetrationClass` / `penetrationScale`), keeps `Hit.piercing` as the energy-rule fallback and reads no calibre
  names: `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are removed (breaking). `shoot` takes `{ penetration, piercing, ... }` or a bare piercing factor.
  `game-test-room` passes the round of the shot to the world.
- 9f7dadf: The grenade correction is always on: `breach.blastReach` is removed (breaking, it was off by default). A blast opens a breach only within 0.12 m per
  cube root of kilojoule of the part (`BREACH_BLAST_REACH`), with no flag and no second path. The `gas_explodes` scenario of the `house-scenarios` golden was
  regenerated: the window, 2.3 m from the gas bottle (60 kJ reach 0.47 m), no longer shatters on the blast (the breach does not reach it).
- d610199: A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
  hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
  `game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
  tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
  built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
  ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
  heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
  `defaultEffectIds.leakIgnited`, asked when the tank catches fire.
- fa6ea00: Structure: a slab or beam is held by the sum of its supports (documented and tested: four columns share the load, each loss moves it to the rest, the
  slab falls when the capacity left is less than the load). New world option `structure: { safetyFactor }` (default 1) multiplies every load before it
  meets the capacities. `game-floorplan-three`: `SpecimenDef.sizing` (`safety`, `redundancy`, `safetyOthers`) sizes a specimen; the frame house of the
  area (`house_casa_portico`) is sized at 0.72 / 0.97 (four pillars: one lost 0.96, two lost fall), so `house_two_pillars` passes with the team's own
  sequence (two pillars) in the real room, and the extended hit sequence the module used as a workaround is gone.
- 024d0e8: Real structure (T10, steps 1 and 2). `game-contracts`: `PartSpec.structure.rebar` (`TensionRebar`: `ratio`, `yieldMPa`, `cover`), `PartState.flexure`
  and `PartState.cracked`. `game-destruction`: concrete (C25) and ceramic brick get `MaterialDef.strength` and capacities from the real strengths
  (NBR 6118, NBR 16868-1 slenderness, reinforced columns `0.85 fck Ac + As fy`), so an overloaded bearing wall crushes at the ground floor first;
  beams and slabs with `structure.rebar` bend (`structure.flexure`, scope `'rebar'` by default): the tension face cracks under a blast and the steel
  holds, a plain beam snaps, yielded steel past 10° hinges and the part falls in one piece; `sizeRebar`, `bearingWallThickness`, `buildFrame({ rebar })`;
  `rebar` joints of reinforced parts no longer wear under blows. Documented capacities change (a 30 x 30 cm concrete column now 203 t, a 20 cm brick
  wall 41 t per metre). `game-floorplan-structure`: `toDestructibleSpec({ rebar })` (off by default) declares and sizes the steel of concrete beams
  and slabs (`REBAR_RATIOS`).
- 20cc300: Skyscraper typology (T10 §11), built from the tower systems, soil, piles and wind of the earlier steps. `game-floorplan-structure`: `buildSkyscraper`,
  `skyscraperLayout`, `SKYSCRAPER_DEFAULTS` (storeys, height, bays, facade, plant floor every N, damper, wind, soil, piles, all options), `pilesFor` and
  `PILE_DEFAULTS` (piles sized by the load and the soil), `addPunchedFacade`, relay mechanical floors in `buildTower` (`mechanical.every`), and the room-level
  plan helpers `towerPlate`, `towerFloors`, `exteriorWindows`. `game-floorplan-commercial`: the `office_tower` template (`officeTowerTemplate`,
  `OFFICE_TOWER_DEFAULTS`, `buildOfficeTower`), the `office_open` library. `game-floorplan-residential`: the `residential_tower` template, the `living_tower`
  library and the zone `zt` (towers, 80 storeys, 320 m). Both packs now depend on `game-floorplan-structure` (peer). `game-urban`: opt-in `towers` option
  (`createUrban({ towers })`, off by default and then byte-identical): tall buildings of the block or avenue drawn as towers of the office and residential
  presets, with `minHeight`, `presets`, `mast` and a `provider`; the pack `TOWER_PATTERNS` adds the `financial_district` avenue. `game-destruction`:
  `verticalBarCount`, so a wall or column holds in tension every bar its spacing puts in (the drawn cage is capped; the capacity was not following it, and
  the walls of the core of a tall tower failed in tension). `game-floorplan`: the walkability grid tests only the walls near the room (same result, a tower
  floor no longer costs seconds).
- d24de8a: Soil and foundations (T10 §8). `game-contracts`: `DestructibleSpec.soil` (`SoilProfile`, `SoilLayer`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`) and the `settle` event. `game-destruction`: soil classes with the NBR 6122 basic pressures (`SOILS`), footings as
  elastic-plastic springs (subgrade modulus of a rigid footing, safety 3), piles by Décourt-Quaresma (`pileCapacity`, `pileLength`), and the object as a
  rigid body on them with the 1/200 out-of-plumb and P-delta: it settles, a heavy building on soft soil sinks, leans and tips over, on piles to firm
  ground it holds; `buildFrame({ footing, raft, piles, soil })`; option `soil` (`SOIL_DEFAULTS`). Off unless a spec has `soil`. `game-destruction-three`:
  draws the settlement and tilt under a `destruction-soil` node. `game-floorplan-structure`: `toDestructibleSpec({ soil, foundation, piles, soils })`
  puts the house on a raft (with piles) or on footings under each wall (`RAFT_THICKNESS`, `PILE_AREA`).
- cd2d333: Building systems of tall buildings (T10 §9). `game-contracts`: `PartSpec.contains.outflow` (the direction a fluid leaves a hole: roof water runs
  down). `game-destruction`: `buildFrame({ continuousColumns, columnCage, roofThickness })` (a 20-storey frame stands on continuous columns).
  `game-floorplan-structure`: `buildTower` and `addCore` (reinforced concrete shear-wall tube with stairs and elevator shafts, the strongest part in a
  blast), `addCurtainWall` (glass hung from the slab edges, shatters in large shards), `addFlatRoof` (screed sloped to the drains, EPDM membrane that
  leaks when punctured), `addMechanicalFloor` (elevator machines, water tank, chillers in the load), with `*_DEFAULTS`, `coreSize` and `towerWater`.
- e9a0932: Structure, step 4: wind and sway (gap 5). New world option `wind` (off by default, so nothing changes without it): NBR 6123 pressure that grows with
  height, drag, a wall-and-frame lateral system (walls as a cantilever, columns and T-beams as a shear frame), top deflection and drift against H/500,
  overturning, axial forces from the wind moment, a gusting sway with a tuned mass damper, `world.setWind`, `ObjectState.wind` and the `sway` event.
  `sizeStructure({ wind })` sizes for it; the wind moment tilts buildings on soft soil. `game-floorplan-structure`: `addTunedMassDamper`,
  `DAMPER_DEFAULTS` and `buildTower({ damper, wind })`. Every number is an option with a default and its source in the T10 spec section 10.
- 0e27281: A `tie` joint (rope, cord, canvas lashing) now only bears load when the supported part hangs below the part it is tied to (a lamp from a ceiling). A rope to a stake in the ground, or to a pole beside the canvas, no longer holds anything up, so a tent whose poles are cut collapses even though its guy ropes and stakes are intact. Hold a canvas up with `resting` (or another pushing joint) on its poles, and keep the ropes as `tie`. `hinge` and `clip` are unchanged (they hold from the side).

### Patch Changes

- e4663e1: A structural part that never had a support path (the spec leaves it floating, for example an upper floor resting on a wall that is only a `partition`) is no longer reported as collapsed by the first unrelated loss. It used to sit in its own unanchored group from the start and fall as soon as any column broke (a houses frame lost 64, 22 and 3 parts to a single pillar this way). Such parts are now held by their joints like non-structural ones and still fall with whatever they hang on.
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.
- d032102: A bullet that punches through a thin ductile sheet (5 mm or less) now also dishes it around the hole: a `dent` event whose depth grows with the shot's energy.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0

## 0.7.2

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.7.1

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.7.0

### Minor Changes

- 968d7df: Shelter, fragment hits and confinement for blasts (`DestructionOptions.blast`, `explode(..., options)`, explosive `Hit`), all off by default and with every number an option; `Hit.piercing` and `piercingOf` (soft lead does not go through steel on energy alone); `breach.blastReach`; glass `damageScale.shelter`. `tests/beams-and-columns.test.ts` documents real calibres against beams and columns.

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.6.1

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

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
