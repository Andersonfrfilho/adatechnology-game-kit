# @adatechnology/game-test-room

## 0.11.1

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-destruction-three@0.7.3
  - @adatechnology/game-fluids-three@0.3.1
  - @adatechnology/game-vfx-three@0.2.1

## 0.11.0

### Minor Changes

- cca7380: The `body` events reach the running film of the liquids (T5.3e). `createFluidsBridge` takes a `film` sink (the `splat` of `createFilmBridge`): a `wound` throws 3 drops of blood, a `severed`, `destroyed` or `split` segment throws 4, 7 or 10 (options `spray`, `burstDrops`), thrown along the way out, in the colours of the body's `BloodLook` (`WoundBody.blood`). `bloodLookOfAge(age)` reads `ages.json` (fresh and dry colours, `blood` as the amount; ages thinner than 0.3 bleed `old_blood`), and the characters area takes `film` and `bloodOf(age)`. The test room exposes the film bridge as `room.film`.
- 485acc7: The weather reaches the other packages (T6.2b). `game-weather` gets `createWeatherBridges(targets, options)`: every target is optional and a small interface of its own (so the weather imports none of them) - the fluids film (`setWeather({ rain, drying })`, with `wash()` every second while the rain is heavy or stronger), `interactables.water.setRain(mm/h)` and `setWind(x, z)`, the vegetation `setWind({ direction, strength: min(1, speed / 20), gust })`, the vfx `setWind`, the environment bus (`environmentOf(sample)`) and the sound. The rain, wind and thunder are recipes of `game-audio` (`WEATHER_BANK`: `rain_loop` and `wind_loop` from the art scene L1314-L1315, `rain_hiss_game` from the game L62116, `thunder` from the game's boom plus a rumble), played by `createWeatherSound` (rain 0.035 in a light rain to 0.06 in a heavy one, wind 0.05 at the breeze and in proportion, the thunder at its bearing when `thunder` arrives). `createWeatherTestModule` takes `targets` and `sound`. `game-fluids` films take `drying` (an extra scale on the drying; extreme heat is 2) and `wash(maxDryness = 0.5)`; `game-fluids-three` passes both on (`FilmBridge.setWeather({ rain, drying })`, `wash`, option `washable`, default blood and old blood); `VfxWorld` gets `setWind` and `wind`; the test room exposes `room.vfx`. `@adatechnology/game-weather` now depends on `@adatechnology/game-audio`.

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-destruction-three@0.7.2
  - @adatechnology/game-fluids@0.3.0
  - @adatechnology/game-fluids-three@0.3.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2
  - @adatechnology/game-weapons@0.4.5

## 0.10.0

### Minor Changes

- 98ae206: `ModuleHost.addBlocker(blocked)`: a module with walls of its own (a house) keeps the walking player out of them; the function is asked on every step with the player's radius and may follow a door that opens. `ModuleHost.onClear(listener)`: a module that put things in the world on its own follows the room clearing its area (`clear()`, opening an area, scenarios) to take them away. Both optional; the room lends them.

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-audio@0.1.2
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-destruction-three@0.7.1
  - @adatechnology/game-fluids@0.2.3
  - @adatechnology/game-vfx@0.1.3
  - @adatechnology/game-vfx-three@0.1.3
  - @adatechnology/game-weapons@0.4.4
  - @adatechnology/game-fluids-three@0.2.3

## 0.9.0

### Minor Changes

- 968d7df: The room's explosions take blast options (`blast` option, `blast()` / `setBlast()`, three HUD toggles in pt-BR and en) and show the last blast in new metrics `blast_shelter`, `blast_confinement` and `blast_fragments` and in the log.

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction-three@0.7.0
  - @adatechnology/game-destruction@0.7.0
  - @adatechnology/game-audio@0.1.1
  - @adatechnology/game-fluids@0.2.2
  - @adatechnology/game-vfx@0.1.2
  - @adatechnology/game-vfx-three@0.1.2
  - @adatechnology/game-weapons@0.4.3
  - @adatechnology/game-fluids-three@0.2.2

## 0.8.0

### Minor Changes

- 0f9e616: The room lends `host.audio` (a sink over the room's sound engine, the listener following the camera every frame) and `host.environment` (a bus; calm dry day by default) to the modules it loads. New options `audio` (an engine, or `false` for a silent room) and `environment`, and `room.audio` and `room.environment`. The destruction renderer's sound keys play on the room engine.

### Patch Changes

- Updated dependencies [7fd46fb]
- Updated dependencies [0f9e616]
- Updated dependencies [3a8cc95]
- Updated dependencies [0f9e616]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-audio@0.1.0
  - @adatechnology/game-destruction-three@0.6.0
  - @adatechnology/game-destruction@0.6.1
  - @adatechnology/game-fluids@0.2.1
  - @adatechnology/game-vfx@0.1.1
  - @adatechnology/game-vfx-three@0.1.1
  - @adatechnology/game-weapons@0.4.2
  - @adatechnology/game-fluids-three@0.2.1

## 0.7.0

### Minor Changes

- 496b397: The test room shares one effects world (T5.1g). It creates a single `createVfxRenderer` (screen overlay in the container), passes its world to the destruction renderer, lends it to every module as `host.effects`, steps it once per frame, wraps its render in `applyCamera` (new `TestRoom.applyCamera()` for hosts that render themselves) and counts its pools in the `particles` metric. Grenades, rockets and charges play the profile of their explosive (`vfx.world.explosion(explosive, point, { direction })`; the destruction renderer keeps only the shove and the sound), and the `explosion` host event carries `explosive` (also for parts that blow up, from `explodes.effect`). New option `craters` replaces the floor with a deformable ground patch that big explosions dig into (default off). `game-weapons-three`: the explosives it puts in the world (fuel barrel, propane cylinder, car tank) name their effect in `explodes.effect`, so their blast is the explosive's profile.
- 6aa11f1: The effects bench (T5.2d, spec 001). `game-vfx-three` draws the Workshop pools (soft-point sprites with the page's shader, streaks, instanced debris, wet and dry decals, rings, flash and fire lights) when the first recipe plays, merges the Workshop screen into the overlay, understands `configure({ quality, layer_<id> })` and exports `createVfxTestModule({ locale })` (id `vfx`, group `effects`): explosion or recipe by group, variant, replay, auto replay, distance, LOD band, quality, six layers, counters against the budget and a sheet with a timeline. `game-test-room` implements the contracts the bench needs: `ModuleBench.sheet` (a card with facts, steps, swatches and a timeline whose playhead follows a module metric), `ChoiceOption.group` (`optgroup`; grouped options never become buttons) and a numeric `MetricRow.value`.
- 6aa11f1: Bridges of the film (T5.3e, spec 001). `createFilmBridge({ fluids, manager, random })`: a `leak` of a liquid that has a film (blood, old blood, bile, motor oil, fuel; `liquids` maps others) throws drops from the hole into the film until the stream ends; `splat({ fluid, point, direction, tint })` throws drops in the colours of a splash (an infection age; the characters will use it for a wound); `setWeather({ rain })` is the rain hook for Phase 6. `tinted(profile, tint)` and `launch({ tint })` draw a grid in a splash's colours. The test room runs the film manager and the bridge (a punctured can of fuel drips into a grid on the floor). The `body` event is not in the contract yet, so the characters side is still to wire.

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
- Updated dependencies [ba652e9]
- Updated dependencies [0d9cb33]
- Updated dependencies [6aa11f1]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
  - @adatechnology/game-vfx-three@0.1.0
  - @adatechnology/game-destruction@0.6.0
  - @adatechnology/game-destruction-three@0.5.0
  - @adatechnology/game-fluids-three@0.2.0
  - @adatechnology/game-fluids@0.2.0
  - @adatechnology/game-weapons@0.4.1

## 0.6.1

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [afffd1b]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
- Updated dependencies [86179cc]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-weapons@0.4.0
  - @adatechnology/game-destruction@0.5.0
  - @adatechnology/game-destruction-three@0.4.0
  - @adatechnology/game-fluids@0.1.8
  - @adatechnology/game-fluids-three@0.1.8

## 0.6.0

### Minor Changes

- 572f2fa: Item thumbnails. `game-contracts`: `TestableItem.thumbnail?` (an image URL or inline `<svg…>` markup), optional and additive. `game-test-room`: `TestRoomItem.thumbnail` and `InspectInfo.thumbnail`; the room draws the picture above the name in the catalogue buttons, in the search results and in the inspector of the aimed item, as a CSS mask over the text colour (a one-colour SVG follows the theme, tones go in opacity; an item without a thumbnail shows its name only).

  `game-weapons-three`: a thumbnail for every weapon of the arsenal and for the explosives that stand in the world. `assets/weapon-svg/generated/` holds a side-profile silhouette of the 3D model of each one (4:1, `currentColor`, deterministic, about 2 KB each), `commons/` the outline of a freely licensed Wikimedia Commons drawing where one was found (its own licence, see `LICENSE-NOTE.md`, `CREDITS.md` and `manifest.json`); `WEAPON_THUMBNAILS`, `weaponThumbnailUrl(id, base?)` and `DEFAULT_THUMBNAIL_BASE` resolve them (Commons first), and `createWeaponsTestModule({ thumbnailBase })` fills `TestableItem.thumbnail` (default `weapon-svg/`, `false` for none). The package now publishes `assets/`. The site build copies the folder to `site/dist/weapon-svg`.

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0
  - @adatechnology/game-destruction@0.4.2
  - @adatechnology/game-destruction-three@0.3.3
  - @adatechnology/game-fluids@0.1.7
  - @adatechnology/game-weapons@0.3.1
  - @adatechnology/game-fluids-three@0.1.7

## 0.5.0

### Minor Changes

- bd41a66: Accessories in the hands (T1.7.6 and T1.7.7). `game-contracts`: `ModuleHost.command(ToolCommand)` asks the tool in hand to fit or remove an accessory, toggle a light or laser, fold the stock, switch to the launcher under the barrel or change the stance, and answers `{ ok, reason?, seconds? }`; `HostTool` gains `attachments`, `stock`, `suppressed`, `underbarrelActive`, `mass` and `aimSeconds`, and the `shot` event carries `suppressed`. All additive. `game-test-room` runs the command by the rule of `game-weapons` (the room is the bench: any accessory goes on) and reports what the tool carries.

  `game-weapons-three`: the model records where accessories go (`parts.frames`), what ships on the weapon (`parts.fittings`) and the stock meshes, without changing the default scene (the 77 gallery hashes stay). `rigStock` and `rigUnderbarrel` add the stock pivot (folds by `foldAxis` or slides in by `length - lengthCollapsed`) and the launcher pivot after the build. `fitAttachmentModels(model, fitted, kit, { catalogue, overrides, raycast })` draws the accessories on the wrapper: ports of the gallery (optics, rail, bipod, brakes, drum, belt box) and creations (suppressors, compensator, grip, light with a real `SpotLight`, laser with beam and dot, M203/GP-25/AG36, ammunition backpack, tripod, sling, magazines); `createWeaponsTestModule({ attachmentModels })` and `createWeaponFx({ attachmentModels })` replace or add builders. New clips (`stock_*`, `toggle`, `reload_ugl`, `shot_ugl`) and sounds (`stock_fold`, `light_click`, `attach`); suppressed shots use `computeShotSound({ suppressed })`. `FxLayers` gains `attachments` and `beams`. New dependency: `@adatechnology/game-interactables-three` (the cord of the sling and the belt).

  The weapons area has an accessory bench: one choice per mount of the weapon in hand (only what the rule accepts), the keys L (light), K (laser), V (stock; the room's kick where the weapon has no stock that moves) and U (launcher under the barrel), and the right mouse button aims through the optic where the weapon fires. The interactables test page also carries the weapons module.

- 16c1453: Accessories and stocks, types first (T1.7.1). `game-weapons` gains `attachment-types` (`AttachmentDef`, `MountDef`, `StatModifier`, `FittedAttachment`, `StockDef`, `WeaponSnapshot`), the optional `WeaponDef.mounts`, `fitted` and `stock`, the phases `fit`, `stock` and `switch`, the rule events `attachment`, `toggle`, `stock` and `underbarrel`, and `TriggerResult.suppressed` (also on the `shot` event). Nothing existing changes.

  `game-contracts` gains the `HostEvent`s `attachment`, `toggle`, `stock` and `underbarrel` and the clips `TOOL_CLIP.STOCK` (variants `fold`, `unfold`, `collapse`, `extend`) and `TOOL_CLIP.TOGGLE` (`on`, `off`); `toolAnimationStep` maps `stock` and `toggle`. BREAKING for exhaustive switches over `HostEvent`. The test room reports the new events to modules.

  Data (T1.7.2): `data/attachments.json` (30 accessories: suppressors, brakes, optics, grips, bipod, lights, laser, magazines, barrels, sling, ammunition backpack, tripod, grenade launchers), generated by the catalog tool from the Arsenal §11 lines and `decisions.json`; `firearms.json` gains `mounts`, `fitted` and `stock` per weapon (from the Gallery options plus the muzzle `threads`, `mountNotes`, `stocks` and `integral` decisions) and the length with the stock in for the seven weapons the Arsenal sheet lacks.

  Rule (T1.7.3): `resolveLoadout` and `canFit` (with the `isCompatible` plugin), `WeaponState.fit`, `remove`, `toggle`, `setStock`, `setStance`, `snapshot` and `arsenal.restore`, `aimSeconds` and `mass`. Effects apply in the order set, add, mul with the factory parts taken back out (a weapon without changes runs exactly as before). A suppressed pull sets `TriggerResult.suppressed`; a home-made suppressor breaks at a shot drawn from a salted stream. New rules `rules.attachments` (fit seconds 2/15/30, switch seconds, speed of sound), `rules.aim` (`hipSpread` is 1 in the SDK: the Arsenal's ×6 is a configuration) and `rules.stock`; `ArsenalOptions` gains `attachments`, `patch.attachments`, `remove.attachments` and `isCompatible`. `TriggerResult.status` gains `busy` (an accessory or the stock is being worked on).

  Launchers under a barrel (T1.7.4): the accessories `m203`, `gp_25` and `ag36` name a launcher weapon (`category: 'launcher'`, `tags: ['underbarrel']`) added to `launchers.json`, with the new reload family `underbarrel` (`breech_open`, `round_in`, `breech_close`) and the explosive `vog_25`. A weapon with one fitted has `underbarrel` (a second `WeaponState` with its own ammunition, the M79 launcher rule), `underbarrelActive` and `useUnderbarrel(on)` (phase `switch`); `trigger` and `reload` go to the launcher while it is on and `drain()` carries its events. `ReloadFamily` and the launcher action `family` gain `underbarrel`.

  BREAKING for code that implements the interfaces (not for callers): `WeaponState` gains the required members `attachments`, `mass`, `aimSeconds`, `suppressed`, `stock`, `underbarrel`, `underbarrelActive`, `canFit`, `fit`, `remove`, `toggle`, `setStock`, `setStance`, `useUnderbarrel` and `snapshot`, and `Arsenal` gains the required `attachments`, `canFit` and `restore`; a fake or a wrapper of either has to add them. Taking off a launcher keeps its rounds for that accessory: fitting it again brings them back (grenades are conserved).

### Patch Changes

- Updated dependencies [86b68d7]
- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-weapons@0.3.0
  - @adatechnology/game-contracts@0.6.0
  - @adatechnology/game-destruction@0.4.1
  - @adatechnology/game-destruction-three@0.3.2
  - @adatechnology/game-fluids@0.1.6
  - @adatechnology/game-fluids-three@0.1.6

## 0.4.0

### Minor Changes

- a569662: BREAKING for exhaustive switches over `HostEvent`: a dud round is now its own `{ type: 'misfire', weapon }` event instead of a `shot` with `shots: 0`, so `shot` always carries one or more projectiles. `toolAnimationStep` maps `misfire` to the misfire clip, `toHostEvent` emits it, and the viewmodel, the box effects and the sounds no longer have to test for `shots === 0`.

  `ModuleHost.configureTool(settings)` takes `Readonly<Record<string, string>>` keyed by the id of the module's control (`condition`, `ammo_quality` for the weapons area; before it was `{ condition?, ammoQuality? }`). The test room applies the ids it knows and ignores the rest.

- 9666008: Cooking a grenade: a throwable with a timer fuse takes the pin out on the pull and is thrown on `release(origin?, direction?)`, which now returns the throw with the fuse that is left (`WeaponState.release` returns `TriggerResult | null`, and `WeaponState.cooking` says a pin is out); holding past the fuse sets it off in the hand (`Use` `throw` with `inHand`, and `cooked` for the seconds held). Impact, remote and wire throwables, and a long-fuse dynamite, still act on the pull. The rule emits `{ type: 'cook', phase: 'start' | 'throw' | 'burst', fuse }`.

  BREAKING for exhaustive switches over `HostEvent`: the test room reports the same `cook` event to modules, and `toolAnimationStep` maps it to the new `TOOL_CLIP.COOK` clip (started with the fuse as `duration`, finished on throw or burst). The room throws what is being cooked on release (and when the tool changes).

  Fuses: `ExplosiveDef` gains `fuseRange` (sampled per throw from a stream of its own, so the spread is not moved: the flashbang is the M84 delay of 1.0 to 2.3 s) and `fuseLength` with `burnRate` and `burnTolerance` (the dynamite is 0.03 m of safety fuse at 131 s/m ±10%). `WeaponState.setFuseLength(metres)` and the area's `fuse_length` control set a longer one; from `rules.explosives.placeFuseFrom` (10 s) the explosive is set down lit instead of thrown. `nominalFuse` and `sampleFuse` are exported, and `checkArsenal` reports a bad fuse number.

- 9666008: Trip wire: `ExplosiveDef.tripwire` (`length`, `angleDeg`, `height`; default in `rules.explosives.tripwire`, 10 m ahead and 0.15 m above the charge, derived because no source gives the M18A1 kit length) is carried by the `place` use of a charge with the `wire` trigger (the Claymore), and `tripwireSegment(use)` gives the segment to stretch. The test room draws the wire (`charge_wire`), puts a marker (`charge_marker`) where any charge was set down and sets the charge off when a body (the player, an object of the room) crosses the wire; bodies already on the wire when it was set are let through until they step off. The Y key now fires only the charges for the remote detonator.
- f4da1a6: The test room throws grenades, launches rockets and sets charges down through `ExplosiveBody` of `game-weapons`: the fuse counts from the throw, an impact before the arming
  distance is a dud, the Claymore only reaches its cone (`blastEffect`), the blast behind a launcher is counted (`backblastEffect`) and the player's own zone is logged. Y
  detonates the charges set down. `HostEvent` gains `explosion` (thrown, set down or a part of the world, with the point, energy, reach and cause) for modules that play the
  sound, and `ModuleHost.configureTool({ condition, ammoQuality })` sets the wear of the tools and the quality of their ammunition from a module's bench.
- dc1fbbb: `setTool` plays the draw of the rule (the tool answers `drawing` until it is over), so a script that equips and fires at once needs to wait: new `room.waitUntilReady(maxSeconds?)` advances frames until the tool in hand has no phase and returns the seconds waited. The built-in scenarios use it instead of a fixed 0.4 s.
- c0fcb62: Animation contract for the tool in hand. `HostEvent` gains `cycle`, `stage` and `feed`, and `tool`, `reload` and `clear` carry the seconds the rule gave
  the phase (`duration`, from the weapon `phase`) and the reload `kind`. `game-contracts` adds `toolAnimationStep` (event to move: `play`, `sync`,
  `finish`), `TOOL_CLIP`, the renderer-free `createToolClipPlayer` (scales a clip to the duration of the rule, moves a `ToolRig`, fires clip events, jumps
  to the marker of a reached stage), `scaleClip`, `sampleClip` and `checkToolClips`. The test room now passes the whole weapon cycle to the host.
  Breaking for hosts that call `toHostEvent` directly: the third parameter is an options object (`{ recoil, phase }`).
- 95a9b9b: The weapons are the ones the Galeria 3D do Arsenal drew. `game-weapons-three` replaces the boxes with a port of the gallery builders (pistol, revolver,
  rifle, bullpup, P90, break action, M2, rocket launchers, flamethrowers) for the 78 weapons in `data/models.json`, checked node by node against the page by
  `tools/golden` (the .50 BMG bullet is the only difference: 12,7 mm real against 13,0 in the page), with a cartridge and a case per calibre from its
  dimensions, worn-metal conditions (`new`, `used`, `worn`, `rusty`) and named parts. The weapon in the hands plays clips for the tool-animation
  contract of `game-contracts`: fire, burst, slide and bolt cycle, jam (stovepipe, double feed, failure to extract, misfire), clear, safety lever and the seven
  reloads (magazine swap, tube, top load, revolver, break action, belt, launcher and flamethrower), timed by the seconds the rule gives, with casings, spent
  cartridges, magazines, muzzle flash, heat glow and smoke from a seeded generator. The generic archetypes keep their low-poly prop. The test area lays all 117
  weapons and tools on up to six counters, asleep, each as one rigid body of its measures. `game-test-room` turns the jams of the weapon rule on again, calls
  `draw()` when a tool is picked up (the trigger answers `drawing` for the rule's draw time), and binds X to clear a jam and B to the safety.

### Patch Changes

- 5e3b47a: The projectiles, charges set down and the blast behind a launcher moved out of `room.ts` into `explosives.ts` with an injected context. A thrown item that names no explosive now blasts through the same function as every other (explode log entry, host `explosion` event, player share and fire), and its flight uses `rules.explosives.gravity` instead of a fixed 9.81.
- 85ac930: The tool clip player carries the remainder of a frame into a repeated round that leaves its delay in the middle of it (`time += dt - delay`), so the pose no longer depends on the frame step; `scaleClip` no longer yields NaN for a clip of no duration and `checkToolClips` reports one. Noise bursts of the weapon audio start where they can play whole in the 1.5 s buffer. The cone of a directional charge reaches an object by its bounding box instead of its origin.
- 478c444: Real models and handling rules. `game-weapons` ships 79 real weapons with brand and measures (launchers and flamethrowers included; plus the 42 generic archetypes, which the models point to
  through `archetype`), 28 calibres, 17 explosives, all generated by `tools/weapons-catalog` from the team deliveries, and `createArsenal`
  takes `explosives`, `patch`, `remove`, `include`, `rules` and `strings` and reports every inconsistency at once (`checkArsenal`). The runtime gains
  per-weapon speed and noise, `timings` (draw, reload, empty reload, per round, manual cycle, clear), `draw()`, reload by kind with its steps
  (`RELOAD_STAGES`), `volley` and burst `roundTimes`, jams on their own random stream (`seed ^ 0x6a09e667`, so the spread of a seed does not change) with
  `clearFault()`, a safety, barrel heat, weapon condition and ammunition quality, the noise of a burst, a minimal launcher, and `drain()` for the events.
  Breaking: jams are on by default (`rules: { faults: false }` turns them off), `TriggerResult` has new fields, the calibre noise replaces the weapon noise
  of the archetypes, and `WeaponsStrings` has new keys. `game-test-room` passes `faults: false` for its arsenal until the clear key arrives, maps the weapon
  events to host events and fills `HostTool` `fault`, `safety` and `heat`. `game-weapons-three` lays only the archetypes on the counters (three counters
  hold 39 weapons) until the new layout.
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
- Updated dependencies [cd4aab5]
- Updated dependencies [478c444]
- Updated dependencies [462e8c6]
  - @adatechnology/game-destruction@0.4.0
  - @adatechnology/game-destruction-three@0.3.1
  - @adatechnology/game-contracts@0.5.0
  - @adatechnology/game-weapons@0.2.0
  - @adatechnology/game-fluids@0.1.5
  - @adatechnology/game-fluids-three@0.1.5

## 0.3.0

### Minor Changes

- 71fb367: Module bench: a `TestableModule` can declare `controls` (number, boolean, choice, action), `layers` and `metrics` as data, checked by
  `checkBench`; the host lends a `ModuleBench` (`host.bench`) with the values, the changes, `patch` and `look`. Tool events gain the generic
  cycle names `mode`, `fault`, `clear` and `safety`, and `shot` carries `rounds` and `mode`; `HostTool` may report `mode`, `fault`, `safety` and
  `heat`. The test room keeps a bench per module, draws it in a new panel (controls, layers, counters with budget bars, and a line of room
  counters: fps, frame time, draw calls, triangles, objects, fragments, particles, decals), exposes `room.bench()` and `room.metrics()`, encodes
  the state for a page URL (`bench` option, `encodeBenchState` / `decodeBenchState`), emits `mode` on Q, and detaches a module before attaching
  it again.

### Patch Changes

- 1920f22: `DestructionRenderer.explode(point, energy, radius)` draws a blast that has no exploding part (flash, fire, smoke, light, sound and a shove on pieces in range). `world.explode` emits no event, so a grenade used to leave only debris; the test room now calls the new method when a thrown explosive detonates.

  `explode` is a new **required** member of the `DestructionRenderer` interface: any implementer of the interface (a custom renderer, a test double) must add it.

- Updated dependencies [1920f22]
- Updated dependencies [71fb367]
  - @adatechnology/game-destruction-three@0.3.0
  - @adatechnology/game-contracts@0.4.0
  - @adatechnology/game-destruction@0.3.2
  - @adatechnology/game-fluids@0.1.4
  - @adatechnology/game-weapons@0.1.4
  - @adatechnology/game-fluids-three@0.1.4

## 0.2.0

### Minor Changes

- 6022fe5: Test environments per catalogue group: `openArea(group)` (and the `area` option) clears the room and lays a group in rows, or lays a loaded
  module by its own `area`, with resting surfaces and asleep props. The room is now a `ModuleHost`: modules get the scene, the camera and the
  tool events (shot, reload start and end, empty) through `attach`. The catalogue has a search across every tab and the tests panel a search too.

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0
  - @adatechnology/game-destruction@0.3.1
  - @adatechnology/game-destruction-three@0.2.1
  - @adatechnology/game-fluids@0.1.3
  - @adatechnology/game-weapons@0.1.3
  - @adatechnology/game-fluids-three@0.1.3

## 0.1.3

### Patch Changes

- 463c9cc: Thin brittle shells that shatter now break on the first bullet. For materials with `fracture: 'shatter'` (glass, ceramic) ballistic damage is multiplied by the same `fragility(ductility, thickness)` factor that blunt hits already used: a 9 mm (about 500 J) now shatters a 4-6 mm window pane in one shot (a 5 kg pane took 6 before), a 2 cm glass block takes 4 (15 before) and a 5 cm block 8 (38 before). Ductile materials, shells 2 cm or thicker (factor up to x4.7 only for glass) and `crumble` materials such as tempered glass are unchanged apart from the thickness term. The test room scenario `glass_shatters` now expects the first shot.
- Updated dependencies [4573613]
- Updated dependencies [4babeca]
- Updated dependencies [463c9cc]
- Updated dependencies [5603151]
- Updated dependencies [d913ace]
  - @adatechnology/game-destruction-three@0.2.0
  - @adatechnology/game-contracts@0.2.0
  - @adatechnology/game-destruction@0.3.0
  - @adatechnology/game-fluids@0.1.2
  - @adatechnology/game-weapons@0.1.2
  - @adatechnology/game-fluids-three@0.1.2

## 0.1.2

### Patch Changes

- Updated dependencies [cbcbd82]
  - @adatechnology/game-destruction@0.2.0
  - @adatechnology/game-destruction-three@0.1.2

## 0.1.1

### Patch Changes

- 930b9ab: Add `checkSpec` to game-contracts; `loadModule` runs it for every item with a spec (given, a function, or derived) and logs ✓/✗/⚠ lines.
- 3a094cc: Add the `kick` and `shove` melee tools (pt-BR "chute" and "empurrão") to the arsenal and the default loadout; in the test room V kicks whatever tool is selected, and a `kick_detaches_leg_via_tool` scenario covers the hotbar path.
- fd82f4a: `world.nearestJoint(objectId, point, maxDistance?, tool?)` takes an optional tool kind and then returns the nearest joint that tool can undo (falling back to the nearest joint of any kind only if none qualifies), so a wrench aimed at a wheel picks the hub bolt instead of the tyre clip. The test room's disassemble tool now passes its tool kind.
- 632a45a: Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.
- 9275cc1: `log.download` now works inside a claude.ai Artifact through the `downloads` capability (declined saves are logged as `export_cancelled`), and "Copy JSON" falls back to a selected textarea without `navigator.clipboard`.
- d6c453a: Add `room.pause()` / `room.resume()` / `room.paused` (the simulation stops, the UI and log stay) and `room.walk(to, seconds)` to walk the player along a straight line during subsequent steps and frames.
- Updated dependencies [930b9ab]
- Updated dependencies [cb132c2]
- Updated dependencies [745e342]
- Updated dependencies [cc23a66]
- Updated dependencies [d727a0c]
- Updated dependencies [f1e3349]
- Updated dependencies [3a094cc]
- Updated dependencies [5954706]
- Updated dependencies [fd82f4a]
- Updated dependencies [632a45a]
- Updated dependencies [308a258]
- Updated dependencies [2363a12]
  - @adatechnology/game-contracts@0.1.1
  - @adatechnology/game-destruction-three@0.1.1
  - @adatechnology/game-destruction@0.1.1
  - @adatechnology/game-weapons@0.1.1
  - @adatechnology/game-fluids@0.1.1
  - @adatechnology/game-fluids-three@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 82479e5: Initial release (0.1.0): a first-person three.js test room with a destructible target wall, table and shelf, tools from the arsenal, carrying and throwing, fluid items, a catalogue panel, an inspector, a behaviour log (JSON, NDJSON, text) and 21 scripted scenarios, with an `en` / `pt-BR` locale table.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [5feff74]
- Updated dependencies [0256a5b]
- Updated dependencies [e51b909]
- Updated dependencies [b4c7f81]
- Updated dependencies [5f99ace]
  - @adatechnology/game-contracts@0.1.0
  - @adatechnology/game-destruction@0.1.0
  - @adatechnology/game-destruction-three@0.1.0
  - @adatechnology/game-weapons@0.1.0
  - @adatechnology/game-fluids@0.1.0
  - @adatechnology/game-fluids-three@0.1.0
