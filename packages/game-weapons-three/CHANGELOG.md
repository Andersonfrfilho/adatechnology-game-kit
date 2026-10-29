# @adatechnology/game-weapons-three

## 0.9.0

### Minor Changes

- df42f4b: The test areas use the pieces of the kit instead of boxes: the weapons counters are the buffet of the furniture catalogue, the shelves and the finds table of the items area are a workbench and a meeting table of the catalogue, the 1.80 m reference is a person the host gives (`person` of `createItemsTestModule`; `personSpecOf` of `game-characters-three` is exported for it), and the probe of the sound bench is what the host gives (`probe` of `createAudioTestModule`, a portable radio of the goods catalogue in the kit's room). Without `person` or `probe` the area draws none.
- df42f4b: Weapons the gallery did not model (bat, axe, machete, knife, hammer, crowbar, crossbow, wrench, extinguisher, blowtorch...) are drawn with the team's item model of `game-items-three` on the counters and in the hands, instead of boxes (`buildItemWeaponModel`, `itemModelOfWeapon`, `registerWeaponItemModel`).

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-items-three@0.3.0
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-floorplan-three@0.4.1
  - @adatechnology/game-interactables-three@0.1.9
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-vfx@0.4.1
  - @adatechnology/game-weapons@0.5.1

## 0.8.0

### Minor Changes

- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- b28f7ef: The weapons module brings its own scenarios against its real targets and weapons: the 9 mm dents the 10 mm steel plate and the .50 BMG of the Barrett goes through it, the 9 mm does not go through the concrete block, the pump shotgun drives pellets through the plywood, the hammer dents the steel plate and the cutting torch melts it (`target_steel_heavy_through_hole`, `target_concrete_stops_bullet`, `target_plywood_shotgun_holes`, `target_steel_hammer_dents`, `target_steel_torch_melts`). They replace the generic checks the test room used to ship over its demo items.
- 57078ff: The weapon in the hands lends its hand targets to the host (`host.setHandTargets`): the right hand on the grip, the left on the handguard or the pump, both on a handgun, the left to the magazine while it is changed. Models may name a `parts.grip` pivot.
- 6889db1: The hands work the parts a reload clip moves (`data/hand-work.json`: slide rack or thumb release on a pistol, charging handle on ARs and AKs after an empty reload, bolt handle, loading port, crane, belt cover), following the clip's own timeline; `ToolClipPlayer.running` exposes the clip time. The right index finger rests along the frame, goes to the trigger after a shot and pulls with the trigger part (`HandTargets.fingers.index`).
- d7b0b7b: `world_propane_p13` is the team's real model (`lpg_cylinder_13kg`, valve mesh `valve`) with a real mass and its gas, and the package gets the explosives test area (`createExplosivesTestModule`, id `explosives_area`, group Explosivos/Explosives): a kitchen corner with the cylinder, furniture, a zombie and a survivor, rings at the lethal and injury radii, bench actions to shoot, open the valve, light and throw it in a fire, a blast multiplier, narration in pt-BR and en, and four scenarios.
- f62305b: Reload sounds follow the animation: the reload clips carry `sound` cues (mag release/out/insert/seat, slide release, charging handle pull and release, bolt lift/pull/push/lock, a shell per round, pump, lever, cylinder, speed loader, barrels, belt cover, rocket, grenade, breech and tube) and the viewmodel plays each one at its second, scaled to the weapon's reload time. The recipes are data (`reload-sounds.json`), with a weight and material profile per weapon; `WeaponAudio.cue`, the `reloadCues` option and `createWeaponFx({ onSound })` are new. `ModuleHost.log` takes an optional entry `type` (the weapons area logs one `sound` entry per cue).
- f89a1aa: The reload log says which variant played: `WeaponFx.clips` gives the clips playing with their seconds, and the weapons area logs `kind`, the clip (`reload` or `reload_empty`) and its seconds at every reload start (pt-BR and en). Tests: an empty weapon plays `reload_empty`, one with a round chambered the tactical `reload`.
- 011e17a: Drive first-person muzzle smoke and flash scale from per-weapon data profiles (`smokeless`, `black_powder`, `suppressed`, `none`). Add `propellant` to `CaliberDef`, `.45-70 Government (black powder)` (`45_70_bp`), `MUZZLE_SMOKE` and `muzzleSmokeOf({ caliber, weapon, suppressed })` in `game-weapons`, parameterize `viewmodel_muzzle_flash` in `game-vfx` with smokeless defaults, pass the resolved profile through `createEffects().muzzleFlash` and `viewmodel-events.ts` in `game-weapons-three`, and refine the hot-barrel smoke wisp into a thin rising thread.

  Add a `gallery` smoke profile (never chosen by default) and optional `driftSpread`, `riseSpread`, `sideSpread` and `lifeSpread` values so the recipe can still reproduce the Arsenal gallery's original muzzle smoke exactly.

  Cool the barrel closer to real life: `rules.heat.perShot` is lower (a rifle magazine no longer glows), and the new `rules.heat.visual` (`smokeFrom`, `smokeSeconds`, `glowFrom`, `glowSpan`) sets when the player sees the hot-barrel thread of smoke (only above `smokeFrom` and for `smokeSeconds` after the last shot) and the red glow. `GALLERY_HEAT` keeps the numbers the Arsenal gallery recorded.

- 4c03a62: The weapon in the hands stays out of walls and its hand stays in view. `createWeaponFx({ contact })` (the test area gives it a raycast on the simulation clock) makes the weapon come back from a surface it would go through (`WALL_PULL`: a few centimetres of margin, at most 0.7 m, smoothed); the shooting hand raises the weapon when it would sit below the bottom of the view (`HAND_IN_VIEW`). A flamethrower pulls the trigger finger while the fuel burns.

### Patch Changes

- d111066: Complete the `en` accessory text: every attachment name is now in the English table (same text the catalog fallback gave).
- 9b27571: `ModuleHost.player()` returns a generic `PlayerState` (`position`, `yaw`, `pitch`, `crouching`, `speed`, `running`, `cameraMode`), and `HostEvent` gains `{ type: 'player' }` for when crouching or the camera mode changes. A host implementing `ModuleHost` must add `player()`. The test room answers from its player controller (not crouching, first-person camera for now).
- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [dba2c82]
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [9d7e0c5]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [d796b0f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [69ccd0b]
- Updated dependencies [642f290]
- Updated dependencies [285cf02]
- Updated dependencies [5679830]
- Updated dependencies [8842f5b]
- Updated dependencies [0604035]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [c21c718]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
- Updated dependencies [011e17a]
  - @adatechnology/game-items-three@0.2.0
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-vfx@0.4.0
  - @adatechnology/game-weapons@0.5.0
  - @adatechnology/game-interactables-three@0.1.8
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-audio@0.2.1

## 0.7.2

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0
  - @adatechnology/game-interactables-three@0.1.7

## 0.7.1

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-vfx-three@0.2.1

## 0.7.0

### Minor Changes

- f49e466: The effects of the weapon in the hands move onto `game-vfx`, drawn as the Arsenal gallery draws them. `game-vfx` gets a solid-particle primitive (`MeshSpawn`, `MeshPool`, the `mesh` step: cone, open cone, sphere, icosahedron with their segments, additive or lit material, a place and a turn inside a group, a scale ramp, growth, drag, gravity, spin, fading opacity), the whole turn of a thing (`PlayOptions.orientation`, `Placement.orientation`: pitch and roll included), named numbers (`PlayOptions.values`, read with `variable(name)`), the expression `exp`, a flash light that holds its strength (`flash(..., steady)`), and four recipes in the weapon's own axes with the gallery's numbers and order of draws (`VIEWMODEL_EFFECTS`): `viewmodel_muzzle_flash` (an open cone, four small cones and a core for 55 ms growing from 0.6 by 0.9, a light of 4 k over 2 k metres, six spheres of smoke), `weapon_smoke_puff`, `launcher_backblast` (26 spheres and 14 icosahedra) and `flame_jet` (`floor(420 dt scale)` icosahedra a frame and, half the frames, a sphere of smoke). `game-contracts`: `EffectRequest.orientation` and `EffectRequest.values`. `game-vfx-three` draws the solid particles (`workshop-meshes`) and passes `orientation` and `values` on. `game-weapons-three`: `createWeaponFx({ effects })` and `createViewmodel({ effects })` play those recipes through the host's effect sink; without a sink the viewmodel makes a world of effects of its own (new dependencies on `game-vfx` and `game-vfx-three`). Casings, magazines, the flying rocket and the burning droplets stay as they were.

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-weapons@0.4.5
  - @adatechnology/game-interactables-three@0.1.6

## 0.6.2

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-audio@0.1.2
  - @adatechnology/game-weapons@0.4.4
  - @adatechnology/game-interactables-three@0.1.5

## 0.6.1

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-audio@0.1.1
  - @adatechnology/game-weapons@0.4.3
  - @adatechnology/game-interactables-three@0.1.4

## 0.6.0

### Minor Changes

- 0f9e616: `createWeaponAudio` now runs on `@adatechnology/game-audio`: the three primitives are recipes and the WebAudio trace is the one recorded before the change. New option `engine` to play on a shared engine (the weapons area uses the one the host lends in `host.audio`), with its own random stream. The reload, dry-fire and bolt sounds of the art scene replace the SDK's clicks as the default `MECHANICAL_SOUNDS` (steps `scene_tone` and `scene_noise`). `game-audio` is a dependency.

### Patch Changes

- Updated dependencies [7fd46fb]
- Updated dependencies [0f9e616]
- Updated dependencies [3a8cc95]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-audio@0.1.0
  - @adatechnology/game-weapons@0.4.2
  - @adatechnology/game-interactables-three@0.1.3

## 0.5.0

### Minor Changes

- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).

### Patch Changes

- 496b397: The test room shares one effects world (T5.1g). It creates a single `createVfxRenderer` (screen overlay in the container), passes its world to the destruction renderer, lends it to every module as `host.effects`, steps it once per frame, wraps its render in `applyCamera` (new `TestRoom.applyCamera()` for hosts that render themselves) and counts its pools in the `particles` metric. Grenades, rockets and charges play the profile of their explosive (`vfx.world.explosion(explosive, point, { direction })`; the destruction renderer keeps only the shove and the sound), and the `explosion` host event carries `explosive` (also for parts that blow up, from `explodes.effect`). New option `craters` replaces the floor with a deformable ground patch that big explosions dig into (default off). `game-weapons-three`: the explosives it puts in the world (fuel barrel, propane cylinder, car tank) name their effect in `explodes.effect`, so their blast is the explosive's profile.
- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-weapons@0.4.1
  - @adatechnology/game-interactables-three@0.1.2

## 0.4.1

### Patch Changes

- 32a00c6: `mergeByMaterial` now comes from `@adatechnology/game-props3d` (new dependency); nothing changes for callers of the package. The thumbnails of the twelve melee weapons added for the goods catalog were generated (`weapon-svg/generated`, manifest and credits), and the weapons area test allows eight counters.
- Updated dependencies [76d15b6]
- Updated dependencies [50eee43]
- Updated dependencies [afffd1b]
- Updated dependencies [cc182c7]
- Updated dependencies [32a00c6]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-weapons@0.4.0
  - @adatechnology/game-props3d@0.2.0
  - @adatechnology/game-interactables-three@0.1.1

## 0.4.0

### Minor Changes

- 572f2fa: Item thumbnails. `game-contracts`: `TestableItem.thumbnail?` (an image URL or inline `<svg…>` markup), optional and additive. `game-test-room`: `TestRoomItem.thumbnail` and `InspectInfo.thumbnail`; the room draws the picture above the name in the catalogue buttons, in the search results and in the inspector of the aimed item, as a CSS mask over the text colour (a one-colour SVG follows the theme, tones go in opacity; an item without a thumbnail shows its name only).

  `game-weapons-three`: a thumbnail for every weapon of the arsenal and for the explosives that stand in the world. `assets/weapon-svg/generated/` holds a side-profile silhouette of the 3D model of each one (4:1, `currentColor`, deterministic, about 2 KB each), `commons/` the outline of a freely licensed Wikimedia Commons drawing where one was found (its own licence, see `LICENSE-NOTE.md`, `CREDITS.md` and `manifest.json`); `WEAPON_THUMBNAILS`, `weaponThumbnailUrl(id, base?)` and `DEFAULT_THUMBNAIL_BASE` resolve them (Commons first), and `createWeaponsTestModule({ thumbnailBase })` fills `TestableItem.thumbnail` (default `weapon-svg/`, `false` for none). The package now publishes `assets/`. The site build copies the folder to `site/dist/weapon-svg`.

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0
  - @adatechnology/game-weapons@0.3.1

## 0.3.0

### Minor Changes

- 86b68d7: 21 new weapons (data from `decisions.creations`, each number with its source and reason): `hk_mp5sd3` (integral suppressor), `fn_parafal`, `taurus_t4_civil`, `taurus_th380`, `mossberg_500_cruiser`, `hk_mp5k`, `hk_ump9`, `mini_uzi`, `hk_mp7a1`, `hk_g36`, `hk_g36k`, `hk_g36c` (integral 3x optic on the first two), `fn_m249`, `fn_minimi_para`, `fn_mag`, `rpk`, `sig_mpx`, `mg3`, `pp19_bizon`, `vz61` and `m134`, and the calibres `4_6x30` and `32acp`. The M134 has three modes (hand-held with a belt box, with the ammunition backpack, on a tripod), a rate range (`rpmRange`, 2000 to 6000, 3000 by default) and a barrel spin-up (`spin`). The GP-25 fits only AK weapons (not the SKS). A factory part that is subsonic with its parts on (the MP5SD3) has the subsonic effect in its base numbers. `game-weapons-three` draws them (two new builders: the M134 rotary barrels that turn with each shot, and the Bizon helical magazine), keeps the 77 gallery hashes and has its own golden for the new models; the weapons area has four columns of counters and the M134 on its tripod.
- bd41a66: Accessories in the hands (T1.7.6 and T1.7.7). `game-contracts`: `ModuleHost.command(ToolCommand)` asks the tool in hand to fit or remove an accessory, toggle a light or laser, fold the stock, switch to the launcher under the barrel or change the stance, and answers `{ ok, reason?, seconds? }`; `HostTool` gains `attachments`, `stock`, `suppressed`, `underbarrelActive`, `mass` and `aimSeconds`, and the `shot` event carries `suppressed`. All additive. `game-test-room` runs the command by the rule of `game-weapons` (the room is the bench: any accessory goes on) and reports what the tool carries.

  `game-weapons-three`: the model records where accessories go (`parts.frames`), what ships on the weapon (`parts.fittings`) and the stock meshes, without changing the default scene (the 77 gallery hashes stay). `rigStock` and `rigUnderbarrel` add the stock pivot (folds by `foldAxis` or slides in by `length - lengthCollapsed`) and the launcher pivot after the build. `fitAttachmentModels(model, fitted, kit, { catalogue, overrides, raycast })` draws the accessories on the wrapper: ports of the gallery (optics, rail, bipod, brakes, drum, belt box) and creations (suppressors, compensator, grip, light with a real `SpotLight`, laser with beam and dot, M203/GP-25/AG36, ammunition backpack, tripod, sling, magazines); `createWeaponsTestModule({ attachmentModels })` and `createWeaponFx({ attachmentModels })` replace or add builders. New clips (`stock_*`, `toggle`, `reload_ugl`, `shot_ugl`) and sounds (`stock_fold`, `light_click`, `attach`); suppressed shots use `computeShotSound({ suppressed })`. `FxLayers` gains `attachments` and `beams`. New dependency: `@adatechnology/game-interactables-three` (the cord of the sling and the belt).

  The weapons area has an accessory bench: one choice per mount of the weapon in hand (only what the rule accepts), the keys L (light), K (laser), V (stock; the room's kick where the weapon has no stock that moves) and U (launcher under the barrel), and the right mouse button aims through the optic where the weapon fires. The interactables test page also carries the weapons module.

### Patch Changes

- Updated dependencies [86b68d7]
- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-weapons@0.3.0
  - @adatechnology/game-contracts@0.6.0

## 0.2.0

### Minor Changes

- a569662: BREAKING for exhaustive switches over `HostEvent`: a dud round is now its own `{ type: 'misfire', weapon }` event instead of a `shot` with `shots: 0`, so `shot` always carries one or more projectiles. `toolAnimationStep` maps `misfire` to the misfire clip, `toHostEvent` emits it, and the viewmodel, the box effects and the sounds no longer have to test for `shots === 0`.

  `ModuleHost.configureTool(settings)` takes `Readonly<Record<string, string>>` keyed by the id of the module's control (`condition`, `ammo_quality` for the weapons area; before it was `{ condition?, ammoQuality? }`). The test room applies the ids it knows and ignores the rest.

- 9666008: Cooking a grenade: a throwable with a timer fuse takes the pin out on the pull and is thrown on `release(origin?, direction?)`, which now returns the throw with the fuse that is left (`WeaponState.release` returns `TriggerResult | null`, and `WeaponState.cooking` says a pin is out); holding past the fuse sets it off in the hand (`Use` `throw` with `inHand`, and `cooked` for the seconds held). Impact, remote and wire throwables, and a long-fuse dynamite, still act on the pull. The rule emits `{ type: 'cook', phase: 'start' | 'throw' | 'burst', fuse }`.

  BREAKING for exhaustive switches over `HostEvent`: the test room reports the same `cook` event to modules, and `toolAnimationStep` maps it to the new `TOOL_CLIP.COOK` clip (started with the fuse as `duration`, finished on throw or burst). The room throws what is being cooked on release (and when the tool changes).

  Fuses: `ExplosiveDef` gains `fuseRange` (sampled per throw from a stream of its own, so the spread is not moved: the flashbang is the M84 delay of 1.0 to 2.3 s) and `fuseLength` with `burnRate` and `burnTolerance` (the dynamite is 0.03 m of safety fuse at 131 s/m ±10%). `WeaponState.setFuseLength(metres)` and the area's `fuse_length` control set a longer one; from `rules.explosives.placeFuseFrom` (10 s) the explosive is set down lit instead of thrown. `nominalFuse` and `sampleFuse` are exported, and `checkArsenal` reports a bad fuse number.

- 5314212: The weapons area draws each modeled weapon on a counter as one mesh per material (the model baked into its group and joined), instead of one mesh per part: about 12x fewer draw calls. The weapon in the hands keeps the model with its pivots. Archetypes that only borrow the model of a brand weapon (`ARCHETYPE_MODELS`) are no longer laid on the counters next to that brand; they stay in the catalogue and can still be held.
- f4da1a6: The weapons area finishes Phase 1. The weapon in the hands and the area play the shot sound from the calibre (energy and the distance from the listener, `computeShotSound`)
  and the mechanical sounds of the rule events through `mechanicalSoundOf` (reload stages, cycle, jam, clear, safety, dry fire, misfire); an `explosion` host event plays the
  game class by the distance from the camera. The bench of the module: layers `muzzle_flash`, `casings`, `magazines`; controls `condition` (rule and materials), `ammo_quality`
  and `sound_distance`; metrics `casings_live`, `magazines_live` and `heat` (max 100). Each generic archetype wears the model of the first brand weapon (lowest id) that points
  to it and fires the same way (`ARCHETYPE_MODELS`); melee, bow and throwables keep the simple prop. The area gets a fuel barrel, a propane cylinder and a car fuel tank in the
  east corner (`worldExplosiveItem`, with `explodes.chain` from the explosive data), so a bullet starts the chain reaction.
- 95a9b9b: The weapons are the ones the Galeria 3D do Arsenal drew. `game-weapons-three` replaces the boxes with a port of the gallery builders (pistol, revolver,
  rifle, bullpup, P90, break action, M2, rocket launchers, flamethrowers) for the 78 weapons in `data/models.json`, checked node by node against the page by
  `tools/golden` (the .50 BMG bullet is the only difference: 12,7 mm real against 13,0 in the page), with a cartridge and a case per calibre from its
  dimensions, worn-metal conditions (`new`, `used`, `worn`, `rusty`) and named parts. The weapon in the hands plays clips for the tool-animation
  contract of `game-contracts`: fire, burst, slide and bolt cycle, jam (stovepipe, double feed, failure to extract, misfire), clear, safety lever and the seven
  reloads (magazine swap, tube, top load, revolver, break action, belt, launcher and flamethrower), timed by the seconds the rule gives, with casings, spent
  cartridges, magazines, muzzle flash, heat glow and smoke from a seeded generator. The generic archetypes keep their low-poly prop. The test area lays all 117
  weapons and tools on up to six counters, asleep, each as one rigid body of its measures. `game-test-room` turns the jams of the weapon rule on again, calls
  `draw()` when a tool is picked up (the trigger answers `drawing` for the rule's draw time), and binds X to clear a jam and B to the safety.
- 462e8c6: Gunshot sound from the team game: `computeShotSound` (pure, no WebAudio) gives the sound class, gain, cutoff and duration from the calibre energy, the distance, a suppressor and indoors, using the game's class table and its distance muffling (`gain / (1 + d² × 0.004)`, `cutoff / (1 + d × 0.01)`, silent under 0.01). The game calibres sound exactly as in the game; the energy scales loudness, length and brightness around the class. Classes, curves, class picker and mechanical sounds are options of `createWeaponAudio(volume, options)`, and the noise is seeded (`seed`), so the same seed gives the same sound.

  New: `WeaponAudio.shotSound`, `mechanical(id)` (every `RELOAD_STAGES` id, `dry_fire`, `jam`, `safety_on`/`safety_off`, `clear_start`/`clear_end`...), `event(weaponEvent)`, `play(soundClass, volume, distance)`; `shot(energyJ, category, extras?)` takes the distance, suppressor and indoors. `game-weapons` exports `createRng`.

### Patch Changes

- 9666008: The revolver model draws as many chambers as the weapon holds (`options.chambers`, written by the catalog tool from the data): 7 on the S&W 686, 6 on the others and on the generic revolvers that borrow a brand model. This is an owner-decided deviation from the Galeria page, which draws 6 for every revolver.
- 85ac930: The tool clip player carries the remainder of a frame into a repeated round that leaves its delay in the middle of it (`time += dt - delay`), so the pose no longer depends on the frame step; `scaleClip` no longer yields NaN for a clip of no duration and `checkToolClips` reports one. Noise bursts of the weapon audio start where they can play whole in the 1.5 s buffer. The cone of a directional charge reaches an object by its bounding box instead of its origin.
- cd4aab5: `checkArsenal` (and so `createArsenal`) reports a `defaultCondition` or `defaultAmmoQuality` that the rules do not define, the rules patch ignores `__proto__`, `constructor` and `prototype` keys, and `weaponsLayout` throws when the weapons do not fit on the counters instead of stacking them on the last one.
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
  - @adatechnology/game-contracts@0.5.0
  - @adatechnology/game-weapons@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0
  - @adatechnology/game-weapons@0.1.4

## 0.1.0

### Minor Changes

- 75ed299: New package: the three.js side of `@adatechnology/game-weapons`. Low-poly weapon models with the real weight of each weapon, the weapon in the
  hands with fire and reload motion, ejected casings (revolvers and break-actions dump theirs on reload), dropped magazines, sounds synthesized
  with WebAudio, and the weapons test area as a `TestableModule`: every weapon on counters, targets, and the presentation attached to the host.

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0
  - @adatechnology/game-weapons@0.1.3
