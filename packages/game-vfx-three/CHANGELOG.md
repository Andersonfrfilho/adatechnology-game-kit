# @adatechnology/game-vfx-three

## 0.9.1

### Patch Changes

- Updated dependencies [779f9f4]
  - @adatechnology/game-contracts@0.34.0

## 0.9.0

### Minor Changes

- 08b9519: The muzzle flash stays on the muzzle while it burns. It was played into the world at the muzzle and stayed there, while the gun follows the view: turning the view at 2 rad/s, in the three frames the flash lives it slid 50 to 95 px back over the gun (onto the receiver and the trigger of a rifle, off the side of a pistol), more with a faster turn or the kick of a heavy round.

  - `EffectRequest.track` (`game-contracts`, with `EffectPose`): the live pose of the thing an effect belongs to, asked every frame while the effect lives.
  - `game-vfx`: an effect played with `track` rides on it. Its grouped pieces (the flash's cones and core) and its light keep their place on the thing; the smoke it throws leaves from the thing and stays in the air. `VfxWorld.follow()` moves them to where the thing is now, and `PlayOptions.track` carries the pose.
  - `game-vfx-three`: `VfxRenderer.present()` puts what rides on a thing where it is after the frame moved it, before drawing; a host that does not call it draws those effects one frame late.
  - `game-weapons-three`: the flash of the gun in the hands (and of its grenade launcher) tracks the muzzle mark, seen through the first-person lens.
  - `game-test-room`: calls `vfx.present()` once the modules have posed the gun.

  `muzzle-mark.test.ts` checks that every firearm with a model has its `muzzle` mark at the front of its barrel. `muzzle-screen.test.ts` now also measures the smoke and a shot while the view sweeps, in both views, and fails when a firearm has no muzzle mark.

### Patch Changes

- Updated dependencies [08b9519]
  - @adatechnology/game-contracts@0.33.0
  - @adatechnology/game-vfx@0.12.0

## 0.8.1

### Patch Changes

- Updated dependencies [4e2d44b]
  - @adatechnology/game-contracts@0.32.0

## 0.8.0

### Minor Changes

- 99183cb: Pushing, as in the real world. A pushed piece that meets a loose one shoves it along when the legs beat the frictions of the whole row (`canPush`, `pushSpeedFor` and `pushAccelerationFor` take a row; `FurniturePush.setLoad`), and locks when they do not. Dragging scratches the floor by its material (`dragMarks` in `FurniturePushRules`, `dragMarkFor`): wood and tile scratch, concrete scuffs, dirt and sand furrow, carpet and grass keep no mark; the scratch is a persistent `scrape` mark of `game-vfx` (`VfxWorld.scrape`, at most `SCRAPE_LIMIT`, the oldest leaving first), drawn instanced by `game-vfx-three`. Civilians walk round a piece of furniture along its face instead of shoving it (`crowd.movableAt`, `bodyRadius`), and `flee` starts its own stuck count. A liquid spilled on a table top goes with the pushed table (`FluidWorld.moveSurface`). `world.sweepBox` ignores a list of objects.

### Patch Changes

- Updated dependencies [82f44ab]
- Updated dependencies [99183cb]
- Updated dependencies [1dea1ac]
  - @adatechnology/game-contracts@0.31.0
  - @adatechnology/game-vfx@0.11.0

## 0.7.6

### Patch Changes

- Updated dependencies [c4b8218]
  - @adatechnology/game-contracts@0.30.0

## 0.7.5

### Patch Changes

- 3894641: Black smoke (burning plastic, foam, rubber, asphalt) reads as a cloud, not as a flat black blob: the puff shader keeps a floor of albedo for the dark puffs, as soot still scatters some light, and lights their rim with the sky so the volume shows. Grey and white smoke, dust and fire keep the Lab's look.
- Updated dependencies [8976efa]
- Updated dependencies [b1f747f]
  - @adatechnology/game-vfx@0.10.1
  - @adatechnology/game-contracts@0.29.0

## 0.7.4

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
- Updated dependencies [5170e39]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vfx@0.10.0

## 0.7.3

### Patch Changes

- Updated dependencies [45fd34d]
  - @adatechnology/game-vfx@0.9.0

## 0.7.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0

## 0.7.1

### Patch Changes

- Updated dependencies [c8b0e40]
  - @adatechnology/game-contracts@0.26.0

## 0.7.0

### Minor Changes

- 6c3877d: The scorch and dirt marks of a blast follow the crater the host's terrain dug instead of lying flat over it and hiding it: `VfxWorld.hostGroundAt` hands over the host height (`VfxOptions.groundAt`), the renderer passes it to the mark layer (`MarkLayerOptions.heightAt`), and where the ground dips under the mark its grid is finer (20 steps per metre, up to 64) so it reaches the bottom of the bowl; flat ground keeps the Explosion Lab grid.

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [6c3877d]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-vfx@0.8.0

## 0.6.0

### Minor Changes

- 157b90d: The warmup draws each effect alone: `EffectWarmup.root` names the subtree the effect draws under, and for its frames every other drawable of the scene is hidden (lights, and whatever holds one, stay, so the program keys are the game's). `VfxRenderer.root` is the group every effect draws under; the test room passes it for the nine blasts it warms. The room was drawn in full 27 times per warmup only to warm the blasts: the second warmup of the room's load went from 62 s to 17 s with software GL, and the page opens in 71 s instead of 113 s.

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.5.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0

## 0.5.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0

## 0.5.0

### Minor Changes

- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [65ccb0c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-vfx@0.7.0

## 0.4.0

### Minor Changes

- 379e44f: A shut car keeps the smoke out. The contracts get `Enclosure` and `EffectSink.enclose`: a closed space (a turned box with openings and a leak) that the
  host's smoke, dust, steam and gas go round. `game-vfx` holds them out in all three particle systems (`VfxWorld.enclose`: the puffs of blasts and
  fires, the carried sprite kinds `smoke`, `dust`, `steam` and `ash`, and the Workshop's light sprites); they cross a wall only through an opening,
  a bullet hole at its small rate, or the leak of the gaps, and what starts inside stays inside. `game-vehicles` gives the cabin of a car as one
  (`cabinEnclosure`): shut, it only seeps; an open door or lid, a shattered window, a door, glass or roof torn off open it; a bullet hole lets a little
  in at the hole, more for a bigger round. `game-vehicles-three` keeps the host told (`createCabinSmoke`) and the vehicles area uses it.

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vfx@0.6.0

## 0.3.6

### Patch Changes

- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0

## 0.3.5

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-vfx@0.5.0

## 0.3.4

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-vfx@0.4.4

## 0.3.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-vfx@0.4.3

## 0.3.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-vfx@0.4.2

## 0.3.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx@0.4.1

## 0.3.0

### Minor Changes

- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

### Patch Changes

- 011e17a: Drive first-person muzzle smoke and flash scale from per-weapon data profiles (`smokeless`, `black_powder`, `suppressed`, `none`). Add `propellant` to `CaliberDef`, `.45-70 Government (black powder)` (`45_70_bp`), `MUZZLE_SMOKE` and `muzzleSmokeOf({ caliber, weapon, suppressed })` in `game-weapons`, parameterize `viewmodel_muzzle_flash` in `game-vfx` with smokeless defaults, pass the resolved profile through `createEffects().muzzleFlash` and `viewmodel-events.ts` in `game-weapons-three`, and refine the hot-barrel smoke wisp into a thin rising thread.

  Add a `gallery` smoke profile (never chosen by default) and optional `driftSpread`, `riseSpread`, `sideSpread` and `lifeSpread` values so the recipe can still reproduce the Arsenal gallery's original muzzle smoke exactly.

  Cool the barrel closer to real life: `rules.heat.perShot` is lower (a rifle magazine no longer glows), and the new `rules.heat.visual` (`smokeFrom`, `smokeSeconds`, `glowFrom`, `glowSpan`) sets when the player sees the hot-barrel thread of smoke (only above `smokeFrom` and for `smokeSeconds` after the last shot) and the red glow. `GALLERY_HEAT` keeps the numbers the Arsenal gallery recorded.

- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [5679830]
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
- Updated dependencies [011e17a]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-vfx@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0

## 0.2.0

### Minor Changes

- d15e990: The weather is drawn (T6.2c). New package `@adatechnology/game-weather-three`: `createWeatherRenderer(THREE, { scene, camera, weather, vfx })` draws the game's rain curtain (14 000 GPU points in a 70 m box falling 13 m/s, shader texts of `jogo.js` character for character, sized by `drops` and the profile), the near rain on the `game-vfx` pools (streaks, splashes, rings), mist and ash, linear or exponential-squared fog with zone fog, the sky (night to day by the sun, dimmed by the weather), the Workshop's double lightning flash, headlights in rain (two spot lights and cones on any object, lit drops in the beam) and a heat haze (SDK-made). `createWeatherVisual` gives the weather bench seven layers and a lamp rig. `game-weather`: `createWeatherTestModule` takes `visual` (`WeatherVisualFactory`). `game-vfx`: the Workshop's `chuva` (`rain_and_puddles`, three intensities), `neblina` (`fog_and_ash`) and `farol` (`headlights_in_rain`) become effects, with `RainField` (`engine.rain`: `init`, `update`, `drive`), the `rain` behavior and the car `point` query. `game-vfx-three` draws the rain field (`workshop-rain` lines).
- f49e466: The effects of the weapon in the hands move onto `game-vfx`, drawn as the Arsenal gallery draws them. `game-vfx` gets a solid-particle primitive (`MeshSpawn`, `MeshPool`, the `mesh` step: cone, open cone, sphere, icosahedron with their segments, additive or lit material, a place and a turn inside a group, a scale ramp, growth, drag, gravity, spin, fading opacity), the whole turn of a thing (`PlayOptions.orientation`, `Placement.orientation`: pitch and roll included), named numbers (`PlayOptions.values`, read with `variable(name)`), the expression `exp`, a flash light that holds its strength (`flash(..., steady)`), and four recipes in the weapon's own axes with the gallery's numbers and order of draws (`VIEWMODEL_EFFECTS`): `viewmodel_muzzle_flash` (an open cone, four small cones and a core for 55 ms growing from 0.6 by 0.9, a light of 4 k over 2 k metres, six spheres of smoke), `weapon_smoke_puff`, `launcher_backblast` (26 spheres and 14 icosahedra) and `flame_jet` (`floor(420 dt scale)` icosahedra a frame and, half the frames, a sphere of smoke). `game-contracts`: `EffectRequest.orientation` and `EffectRequest.values`. `game-vfx-three` draws the solid particles (`workshop-meshes`) and passes `orientation` and `values` on. `game-weapons-three`: `createWeaponFx({ effects })` and `createViewmodel({ effects })` play those recipes through the host's effect sink; without a sink the viewmodel makes a world of effects of its own (new dependencies on `game-vfx` and `game-vfx-three`). Casings, magazines, the flying rocket and the burning droplets stay as they were.

### Patch Changes

- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-contracts@0.13.0

## 0.1.3

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-vfx@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-vfx@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-vfx@0.1.1

## 0.1.0

### Minor Changes

- 51d16d1: New package `game-vfx-three` (T5.1d): the three.js renderer of the Explosion Lab. `createVfxRenderer(THREE, { scene, camera, vfx, overlay })` draws a `VfxWorld` with the Lab's shaders (puffs with the heat ramp and dissolve, streaked shrapnel, halos, shock shell and ground ring; verbatim, with the r160 `colorspace_fragment` chunk), debris with embers, blast and fire lights, scorch, dirt, rim rock and blood marks that conform to the ground as it was when they were made, and the screen overlay (flash, white, red edge, sides, gas). It implements `EffectSink` (`play`, `stop`, `configure`, `stats`, `catalog`) and `applyCamera()` shakes the camera around the render. `createGroundPatch` is the Lab's 60 m deformable patch. `game-vfx` gains `onMarks`, `fires()`, `randomState()`, a `trace` option that hears every spawn in order, and `colorOfChunk`.
- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).
- 6aa11f1: The effects bench (T5.2d, spec 001). `game-vfx-three` draws the Workshop pools (soft-point sprites with the page's shader, streaks, instanced debris, wet and dry decals, rings, flash and fire lights) when the first recipe plays, merges the Workshop screen into the overlay, understands `configure({ quality, layer_<id> })` and exports `createVfxTestModule({ locale })` (id `vfx`, group `effects`): explosion or recipe by group, variant, replay, auto replay, distance, LOD band, quality, six layers, counters against the budget and a sheet with a timeline. `game-test-room` implements the contracts the bench needs: `ModuleBench.sheet` (a card with facts, steps, swatches and a timeline whose playhead follows a module metric), `ChoiceOption.group` (`optgroup`; grouped options never become buttons) and a numeric `MetricRow.value`.

### Patch Changes

- 4415620: `createVfxRenderer` follows the camera also in `play`, so an effect played before the first `update` gets the right LOD. The Lab's 16 scenes are checked against a recording of the page (`game-vfx` pure, `game-vfx-three` scene hash).
- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

- Updated dependencies [cb85470]
- Updated dependencies [3f89fd3]
- Updated dependencies [55037ce]
- Updated dependencies [51d16d1]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
