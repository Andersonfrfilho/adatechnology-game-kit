# @adatechnology/game-fluids-three

## 0.4.3

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-fluids@0.3.4
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3

## 0.4.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-fluids@0.3.3
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2

## 0.4.1

### Patch Changes

- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-fluids@0.3.2
  - @adatechnology/game-vfx@0.4.1

## 0.4.0

### Minor Changes

- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

### Patch Changes

- d3581b5: A sealed container inside an opaque shell (a closed can) no longer draws its liquid body: nothing of it was visible, and a dent deeper than the liquid wall (3 mm inside the shell) let the liquid show through the can as red or dark patches. A glass shell or an opened container still draws it.
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
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-fluids@0.3.1

## 0.3.1

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-vfx-three@0.2.1

## 0.3.0

### Minor Changes

- 485acc7: The weather reaches the other packages (T6.2b). `game-weather` gets `createWeatherBridges(targets, options)`: every target is optional and a small interface of its own (so the weather imports none of them) - the fluids film (`setWeather({ rain, drying })`, with `wash()` every second while the rain is heavy or stronger), `interactables.water.setRain(mm/h)` and `setWind(x, z)`, the vegetation `setWind({ direction, strength: min(1, speed / 20), gust })`, the vfx `setWind`, the environment bus (`environmentOf(sample)`) and the sound. The rain, wind and thunder are recipes of `game-audio` (`WEATHER_BANK`: `rain_loop` and `wind_loop` from the art scene L1314-L1315, `rain_hiss_game` from the game L62116, `thunder` from the game's boom plus a rumble), played by `createWeatherSound` (rain 0.035 in a light rain to 0.06 in a heavy one, wind 0.05 at the breeze and in proportion, the thunder at its bearing when `thunder` arrives). `createWeatherTestModule` takes `targets` and `sound`. `game-fluids` films take `drying` (an extra scale on the drying; extreme heat is 2) and `wash(maxDryness = 0.5)`; `game-fluids-three` passes both on (`FilmBridge.setWeather({ rain, drying })`, `wash`, option `washable`, default blood and old blood); `VfxWorld` gets `setWind` and `wind`; the test room exposes `room.vfx`. `@adatechnology/game-weather` now depends on `@adatechnology/game-audio`.

### Patch Changes

- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-fluids@0.3.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0

## 0.2.3

### Patch Changes

- @adatechnology/game-fluids@0.2.3
- @adatechnology/game-vfx@0.1.3
- @adatechnology/game-vfx-three@0.1.3

## 0.2.2

### Patch Changes

- @adatechnology/game-fluids@0.2.2
- @adatechnology/game-vfx@0.1.2
- @adatechnology/game-vfx-three@0.1.2

## 0.2.1

### Patch Changes

- @adatechnology/game-fluids@0.2.1
- @adatechnology/game-vfx@0.1.1
- @adatechnology/game-vfx-three@0.1.1

## 0.2.0

### Minor Changes

- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).
- 6aa11f1: The running film on screen (T5.3c, spec 001). `createFilmManager(THREE, { scene, camera, random, fluids?, gpu? })` draws the film of `game-fluids` with the Fluid Standard's shader over the host's surfaces (transparent where nothing is wet), strips per layout region, instanced drops in flight and the swelling bead of a drip. It keeps the film near the player: at most 6 grids of 2 x 2 m, only within 30 m, simulated inside a millisecond budget and uploaded by the dirty rectangle (`copyTextureToTexture` when `gpu` is given). A grid that is far, still or squeezed out is baked into the fluid world's stain decals (`fluids.splash` with the film's colours) and freed. `launch`, `drip`, `setWeather({ rain })`, `update`, `stats`, `clear`. Additive: the existing renderer is unchanged.
- 6aa11f1: Bridges of the film (T5.3e, spec 001). `createFilmBridge({ fluids, manager, random })`: a `leak` of a liquid that has a film (blood, old blood, bile, motor oil, fuel; `liquids` maps others) throws drops from the hole into the film until the stream ends; `splat({ fluid, point, direction, tint })` throws drops in the colours of a splash (an infection age; the characters will use it for a wound); `setWeather({ rain })` is the rain hook for Phase 6. `tinted(profile, tint)` and `launch({ tint })` draw a grid in a splash's colours. The test room runs the film manager and the bridge (a punctured can of fuel drips into a grid on the floor). The `body` event is not in the contract yet, so the characters side is still to wire.

### Patch Changes

- 0d9cb33: The team's values as the fluids defaults (T5.3b, spec 001 decision E2). `blood`: `stainColor` `0x3B1D14` (was `0x4A0506`) and `dryTime` 600 s (was 1200). `fuel`: `dryTime` 60 s (was 120) and `leavesMark: false` (was `true`: it evaporates and leaves nothing). `water`: `dryTime` 180 s (was 600). New liquids `old_blood` (`0x6C1C16` drying to `0x2A160E`, 360 s) and `bile` (`0x8A9A2A` to `0x3E4220`, 900 s), with `en` and `pt-BR` names. A game that wants the old values replaces the liquid by id: `createFluids({ liquids: [{ ...blood, dryTime: 1200, stainColor: 0x4a0506 }] })`. New `splash(liquid, point, liters, velocity, { tint: { fresh, dry } })` colours one splash and the stain it makes or joins (`StainState.tint`, kept by `serialize` and `load`), so the age of an infection stays in the characters' data and the liquid stays generic. The README imports `DestructionEvent` from `@adatechnology/game-contracts` (it said `DamageEvent` from `game-destruction`). `game-fluids-three` paints a stain with its `tint` when it has one.
- Updated dependencies [3f89fd3]
- Updated dependencies [55037ce]
- Updated dependencies [51d16d1]
- Updated dependencies [4415620]
- Updated dependencies [aa2c014]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
- Updated dependencies [ba652e9]
- Updated dependencies [0d9cb33]
  - @adatechnology/game-vfx@0.1.0
  - @adatechnology/game-vfx-three@0.1.0
  - @adatechnology/game-fluids@0.2.0

## 0.1.8

### Patch Changes

- @adatechnology/game-fluids@0.1.8

## 0.1.7

### Patch Changes

- @adatechnology/game-fluids@0.1.7

## 0.1.6

### Patch Changes

- @adatechnology/game-fluids@0.1.6

## 0.1.5

### Patch Changes

- @adatechnology/game-fluids@0.1.5

## 0.1.4

### Patch Changes

- @adatechnology/game-fluids@0.1.4

## 0.1.3

### Patch Changes

- @adatechnology/game-fluids@0.1.3

## 0.1.2

### Patch Changes

- @adatechnology/game-fluids@0.1.2

## 0.1.1

### Patch Changes

- @adatechnology/game-fluids@0.1.1

## 0.1.0

### Minor Changes

- b4c7f81: Initial release (0.1.0): three.js renderer for `@adatechnology/game-fluids` with liquid volumes inside bound containers, streams with a drop at the tip, irregular stains that grow from a flow front, wet gloss and drying from the edge, steam and pooled splash droplets.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [e51b909]
  - @adatechnology/game-fluids@0.1.0
