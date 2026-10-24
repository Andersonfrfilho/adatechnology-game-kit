# @adatechnology/game-vfx

## 0.2.0

### Minor Changes

- 485acc7: The weather reaches the other packages (T6.2b). `game-weather` gets `createWeatherBridges(targets, options)`: every target is optional and a small interface of its own (so the weather imports none of them) - the fluids film (`setWeather({ rain, drying })`, with `wash()` every second while the rain is heavy or stronger), `interactables.water.setRain(mm/h)` and `setWind(x, z)`, the vegetation `setWind({ direction, strength: min(1, speed / 20), gust })`, the vfx `setWind`, the environment bus (`environmentOf(sample)`) and the sound. The rain, wind and thunder are recipes of `game-audio` (`WEATHER_BANK`: `rain_loop` and `wind_loop` from the art scene L1314-L1315, `rain_hiss_game` from the game L62116, `thunder` from the game's boom plus a rumble), played by `createWeatherSound` (rain 0.035 in a light rain to 0.06 in a heavy one, wind 0.05 at the breeze and in proportion, the thunder at its bearing when `thunder` arrives). `createWeatherTestModule` takes `targets` and `sound`. `game-fluids` films take `drying` (an extra scale on the drying; extreme heat is 2) and `wash(maxDryness = 0.5)`; `game-fluids-three` passes both on (`FilmBridge.setWeather({ rain, drying })`, `wash`, option `washable`, default blood and old blood); `VfxWorld` gets `setWind` and `wind`; the test room exposes `room.vfx`. `@adatechnology/game-weather` now depends on `@adatechnology/game-audio`.
- d15e990: The weather is drawn (T6.2c). New package `@adatechnology/game-weather-three`: `createWeatherRenderer(THREE, { scene, camera, weather, vfx })` draws the game's rain curtain (14 000 GPU points in a 70 m box falling 13 m/s, shader texts of `jogo.js` character for character, sized by `drops` and the profile), the near rain on the `game-vfx` pools (streaks, splashes, rings), mist and ash, linear or exponential-squared fog with zone fog, the sky (night to day by the sun, dimmed by the weather), the Workshop's double lightning flash, headlights in rain (two spot lights and cones on any object, lit drops in the beam) and a heat haze (SDK-made). `createWeatherVisual` gives the weather bench seven layers and a lamp rig. `game-weather`: `createWeatherTestModule` takes `visual` (`WeatherVisualFactory`). `game-vfx`: the Workshop's `chuva` (`rain_and_puddles`, three intensities), `neblina` (`fog_and_ash`) and `farol` (`headlights_in_rain`) become effects, with `RainField` (`engine.rain`: `init`, `update`, `drive`), the `rain` behavior and the car `point` query. `game-vfx-three` draws the rain field (`workshop-rain` lines).
- f49e466: The effects of the weapon in the hands move onto `game-vfx`, drawn as the Arsenal gallery draws them. `game-vfx` gets a solid-particle primitive (`MeshSpawn`, `MeshPool`, the `mesh` step: cone, open cone, sphere, icosahedron with their segments, additive or lit material, a place and a turn inside a group, a scale ramp, growth, drag, gravity, spin, fading opacity), the whole turn of a thing (`PlayOptions.orientation`, `Placement.orientation`: pitch and roll included), named numbers (`PlayOptions.values`, read with `variable(name)`), the expression `exp`, a flash light that holds its strength (`flash(..., steady)`), and four recipes in the weapon's own axes with the gallery's numbers and order of draws (`VIEWMODEL_EFFECTS`): `viewmodel_muzzle_flash` (an open cone, four small cones and a core for 55 ms growing from 0.6 by 0.9, a light of 4 k over 2 k metres, six spheres of smoke), `weapon_smoke_puff`, `launcher_backblast` (26 spheres and 14 icosahedra) and `flame_jet` (`floor(420 dt scale)` icosahedra a frame and, half the frames, a sphere of smoke). `game-contracts`: `EffectRequest.orientation` and `EffectRequest.values`. `game-vfx-three` draws the solid particles (`workshop-meshes`) and passes `orientation` and `values` on. `game-weapons-three`: `createWeaponFx({ effects })` and `createViewmodel({ effects })` play those recipes through the host's effect sink; without a sink the viewmodel makes a world of effects of its own (new dependencies on `game-vfx` and `game-vfx-three`). Casings, magazines, the flying rocket and the burning droplets stay as they were.

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0

## 0.1.3

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0

## 0.1.2

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0

## 0.1.1

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0

## 0.1.0

### Minor Changes

- 3f89fd3: New package: renderer-free visual effects, a literal port of the Explosion Lab (T5.1b). `createVfx` with the layer compositor (`explosion`: flash and light, fireball that cools into smoke, own smoke, shock wave that pushes the smoke, dust, shrapnel and embers, glowing debris, scorch, crater with a deformable `GroundField`, mushroom, lingering fires), `fire`, `push`, `update` and `pools` for a renderer; seeded streams (`lehmer`, `lcg`, `streamFor`; `per_event` or `shared`), ordered pools that reuse their records, blast lights and fire lights, screen shake and flash with the Lab and Workshop decays, `LOD_GAME` and `LOD_LAB`, the game's area cap (6 in 4 s within 40 m, the extra ones at 0.3), `PROFILES`, `EVENT_BUDGET` and `estimateCost`, a schedule that runs due timers from the last added to the first, and side requests (`crater`, `blast_front`, `ignite`) for what the host does.
- 55037ce: The catalogue of the Lab (T5.1c). `EXPLOSIONS` has the 16 profiles of the Explosion Lab (`PROF`, L795-812) with English names, keyed by the id of the explosive in `game-weapons` (`m67`, `molotov`, `pipe_bomb`, `propane_p13`, `dynamite`, `c4`, `claymore`, `flashbang`, `m79_40mm`, `m72_66mm`, `at4_84mm`, `pg7v`, `fuel_barrel`, `car_fuel_tank`, `fuel_pump`, `fuel_station_tank`), each listing the Lab lines it comes from, and a `generic` one (the M67, for a part with no explosive id: scale it by `injury / 15`). `EXPLOSION_ALIASES` gives the Carl Gustaf the AT4 blast and the VOG-25 the M79 one. `patchExplosions(EXPLOSIONS, { m67: { lethal: 7 }, c4: null })` changes, adds or removes profiles; `createVfx` uses the catalogue by default. `estimateCost` gives the number of the Lab's effect sheet for each one.
- 51d16d1: New package `game-vfx-three` (T5.1d): the three.js renderer of the Explosion Lab. `createVfxRenderer(THREE, { scene, camera, vfx, overlay })` draws a `VfxWorld` with the Lab's shaders (puffs with the heat ramp and dissolve, streaked shrapnel, halos, shock shell and ground ring; verbatim, with the r160 `colorspace_fragment` chunk), debris with embers, blast and fire lights, scorch, dirt, rim rock and blood marks that conform to the ground as it was when they were made, and the screen overlay (flash, white, red edge, sides, gas). It implements `EffectSink` (`play`, `stop`, `configure`, `stats`, `catalog`) and `applyCamera()` shakes the camera around the render. `createGroundPatch` is the Lab's 60 m deformable patch. `game-vfx` gains `onMarks`, `fires()`, `randomState()`, a `trace` option that hears every spawn in order, and `colorOfChunk`.
- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).
- 6aa11f1: The Workshop of VFX as data (T5.2a-c, spec 001). `vfx.play(id, point, { direction?, normal?, seed?, param? })` plays one of the 36 recipes (blood by infection age, headshot, dismemberment, bloater cloud, scream, muzzle flashes and casings by weapon, impact by material, glass, doors, collapses, fires, cars, the screen effects) into the Workshop pools (`vfx.workshop()`, `vfx.peekWorkshop()`: sprites, streaks, debris, decals, rings, lights, screen state, quality 0-2). The recipes are `EffectDef` data (`WORKSHOP_EFFECTS`, `GAME_EFFECTS`, `patchEffects`) run by `EffectInstance`, `EffectRunner` and `EffectPlayer` in the page's own order of random draws; `effectForEvent` and `data/event-effects.json` map the destruction events to effects (`impact_<material>`, `stage_crack`, `breach_dust`, `collapse_dust`, `rebar_expose`, `glass_burst`). Texts of every recipe in `en` and `pt-BR` (`locales`, with a group name for explosions). The goldens replay the recording of the page: 162 assertions over 54 runs and 36 page ids. Additive: nothing existing changes.

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
