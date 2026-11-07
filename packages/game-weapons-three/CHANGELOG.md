# @adatechnology/game-weapons-three

## 0.19.1

### Patch Changes

- Updated dependencies [baaa7d4]
- Updated dependencies [694cad8]
  - @adatechnology/game-audio@0.10.0
  - @adatechnology/game-weapons@0.10.0

## 0.19.0

### Minor Changes

- c4b8218: The photo of the real weapon is now a small thumbnail in the bottom-left corner of the weapons room, opening large (with author, licence and the Wikimedia link) on a click, instead of a big card on the bench panel. `ModuleHost.cornerImage` (contracts) and the room's corner image with lightbox (test-room) are generic; the weapons module shows the photo only with the new `referencePhotos` option (default off, so the general test room shows none). The showcase no longer sends a bench sheet.
- ad5b433: The model kit gets a polished steel material (`chrome`): bright and glossy under plain lights, as the rooms have no environment map for a fully metallic surface to mirror. The Desert Eagle Mark XIX wears it (`chrome` option), as its reference photo shows.

  The Kalashnikovs (AK-47, AKM, RPK, AK-74, AKS-74U) get the stamped receiver of their photos (`kalashnikov`: low and long, the dust cover rising to the rear sight block, the long selector lever and the trunnion rivets) and the banana magazine as one smooth curved solid with its pressed side ribs, the RPK's the longer 40-round one. The anchors (`mag`, `bolt`, `grip`) and the reload stay as they were.

- bb5bf2e: Weapon models redrawn from the photo of the real weapon. The Desert Eagle Mark XIX gets a model of its own (`pistol-deagle.ts`) instead of the generic pistol: one flat-topped upper from the rear to the muzzle (the slide and the fixed barrel block in the same steel, the barrel's triangular nose on the front face, the rail on top), the large squared trigger guard as one piece of the frame, the ring hammer and the thick grip raked back 18°. The anchors (`slide`, `grip`, `mag`, `trigger`, `hammer`, `muzzle`, `eject`) are the pistol's, so the hands, the reload and the shot follow the new shape.

  The SVD Dragunov gets its thumbhole stock (`stock: 'svd'`: the comb with the cheek rest, the butt behind the hole and the bottom bar closing it at the foot of the pistol grip) and its chunky slotted wooden handguard with the gas block (`svd`), in `rifle-svd.ts`; no other rifle uses either option.

  The bolt-action rifles (Remington 700 and its .300 Win Mag and .30-06 hunting versions, M24 SWS, Steyr SSG 69) get the sporter stock of their photos (`stock: 'sporter'`, `rifle-sporter.ts`): the butt dropping from the comb to the toe, the wrist into the pistol-grip swell, the bedding under the receiver and the forend tapering under the barrel, instead of the straight bar on a tall block.

  The AK-47, AKM and RPK get the wedge-shaped wooden stock of their photos (`stock: 'ak'`): the comb falling a little and the belly falling a lot from the receiver to the steel buttplate. The generic 7.62×39 rifle wears the AK-47 model, so it changes with it.

### Patch Changes

- bae13c6: The Kalashnikovs' banana magazine and the Desert Eagle's guard and barrel nose are built once per model kit and shared (`sharedGeometry`), like the smooth stocks: triangulating their outlines on every build put the AKs 9 to 20 times over their shapes-bench baseline. The geometry is unchanged: no golden moves.
- 5cbfe7c: The smooth stocks (`profileSolid`) are triangulated once per kit and shared by every weapon that wears them, instead of on every build.
- Updated dependencies [c4b8218]
- Updated dependencies [5ce9f7b]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-audio@0.9.4
  - @adatechnology/game-floorplan-three@0.11.1
  - @adatechnology/game-items-three@0.7.8
  - @adatechnology/game-vfx-three@0.7.6
  - @adatechnology/game-weapons@0.9.2

## 0.18.1

### Patch Changes

- Updated dependencies [41760ac]
- Updated dependencies [e8cae79]
- Updated dependencies [3894641]
- Updated dependencies [8976efa]
- Updated dependencies [8888b33]
- Updated dependencies [b1f747f]
  - @adatechnology/game-floorplan-three@0.11.0
  - @adatechnology/game-vfx-three@0.7.5
  - @adatechnology/game-vfx@0.10.1
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-items-three@0.7.7
  - @adatechnology/game-audio@0.9.3
  - @adatechnology/game-weapons@0.9.1

## 0.18.0

### Minor Changes

- 20a6526: Four new weapons with models drawn from reference photos: FAMAS (carry handle over the whole top, grooved spigot, folding bipod legs), IWI Tavor (one olive polymer body, full-hand trigger guard, reflex sight on a short rail), L85A2 (steel body with SUSAT optic, tan quad-rail handguard) and Winchester 1887 (lever-action shotgun with tall receiver, big lever loop, wood stock and forend). New `look` option of the bullpup builder and `m1887` option of the rifle builder; the Steyr AUG and the other models are unchanged.
- 624ee79: A weapon in each hand, finished. The magazine change frees a hand as a person does: the other weapon is tucked in the belt (`rules.dualWield.stowSeconds`, 0.45 s), the free hand goes to the magazine well of the weapon being reloaded and back, the weapon is drawn again, then the same the other way round; neither weapon fires meanwhile. The contracts gain `HostTool.stowed`, the `stow` host event and `HandTargets.fingersL` (the left hand's index finger, as `fingers` is the right's); the first-person arms and the player's body curl each index finger by it (the body's right index now follows `fingers` too). Q (fire mode) and B (safety) act on the weapon of the hand that fired last, and X clears the stuck weapon (the last-fired one first).
- b6677b5: A weapon in each hand. `rules.dualWield` of the arsenal says which weapons go one in each hand (the pistols and revolvers by category, the Mini Uzi, Uzi, MAC-10, vz. 61, MP7 and the knives, machete and hatchet by id; a game changes the lists) and how much worse each one shoots then (`spread` 1.8x, `recoil` 1.35x); `canDualWield(arsenal, id)` answers it, and `setStance({ dualWield: true })` applies it and keeps the weapon from aiming. The contracts gain `ToolHand`, `HostTool.offHand` (the left hand's tool, with its own rounds and reload), `hand` on the tool events, a `MuzzleSource` and a `holdFrame` asked by hand. The weapon module draws the left hand's weapon out to the left, the left hand on the mirror of its grip, in both views (`VIEW_HOLD.dual`, `BODY_HOLD.dualGrip`, `oneHandHold`; a stock is folded while held in one hand), and lends each hand's muzzle, so each shot's flash and tracer leave its own gun. The test room: Shift+click in the weapon picker puts two of an eligible weapon in the hands (a second Shift+click changes the left one, a plain click goes back to one); the left mouse button fires the right hand, the right button the left hand (no aiming with two); R reloads the right one, then the left one; `room.setOffTool`, `room.offTool`, `room.useOff` and `room.reload`.
- 970f192: The Heckler & Koch G36, G36K and G36C as the real ones (compared with the photos in `assets/weapon-references.json`): the tall polymer receiver with the stock hinge and the trigger group housing, the skeletal side-folding stock, the grip leaning back, the translucent magazine with the rounds seen through it, and on top the carry handle with its optic and red dot (G36, G36K) or the long rail on two risers ending in the front sight (G36C, with a rail under its short handguard). New `g36` model option and `stock: 'g36'`, `magMat: 'smoke'`; the options are decisions of the catalogue (`weaponModels` in `tools/weapons-catalog/decisions.json`). The goldens of the three models and their silhouettes are regenerated.
- d3f6983: `assets/weapon-references.json`: a photo of the real weapon for each weapon of the arsenal, to compare each model with (123 of 141). Each one is a free Wikimedia Commons file (the image stays on the Commons servers) with its author, licence and page. A file a person checked is pinned (`pinned`, the G36C is not the G36); a weapon with no free photo of its exact model is listed in `missing` instead of borrowing another's. The weapon-thumbnails tool writes it (`node dist/cli.js references`).

  The weapons area gets a showcase: the `showcase_weapon` control puts any weapon with a model on a pedestal (the buffet of the furniture catalogue) behind the counters, turning slowly (`showcase_spin`), takes the camera close to it (`showcase_look`) and shows the photo of the real one with its author and licence, so the model can be compared with it.

  `BenchSheet.image` (game-contracts): a picture of the real thing a sheet is about, with its credit and page; the test room shows it over the scene, top centre, linked to its page.

- 5e7d154: Six more real weapons in the arsenal, each with its model, reload and real numbers (the source of each in `tools/weapons-catalog/decisions.json`, `creations`): AKS-74U, FN SCAR-L, M1 Garand, Accuracy L96A1, Mossberg 590 and FN M240B. A generic weapon now wears the model of a weapon of its own before a variant of another (`variantOf`), so a weapon added later never changes what the generic looks like.
- 0ce0b71: Three more real weapons in the arsenal, each with a model drawn after its photo and not borrowed from another weapon: MP40 (tubular receiver, magazine well, Bakelite housing and grip, ribbed barrel with the rest bar, stock that folds under), B&T MP9 (compact polymer block, magazine in the grip, vertical foregrip, top rail, stock that folds to the right) and FN PS90 (thumbhole stock with the trigger guard cut through the body, translucent magazine on top, integrated optic housing and the 407 mm barrel). Real numbers and sources in `tools/weapons-catalog/decisions.json` (`creations`); the models are `weaponModels` decisions with the new `mp40`, `mp9` and `ps90` builders. The FN P90 keeps its model.
- 0e47730: Four more real weapons in the arsenal, each with a model drawn after its photo and not borrowed from another weapon: PPSh-41 (one-piece wooden stock and body, perforated barrel jacket with the slanted muzzle brake, 71-round drum or curved box, tangent sight), Mauser Kar98k (long bolt action with the turned-down bolt handle, full wooden stock, one barrel band, nose cap with bayonet lug, internal five-round magazine), MG42 (perforated barrel shroud with the barrel-change opening, conical muzzle booster, front bipod, belt feed on the left, butt and pistol grip) and VSS Vintorez (integral suppressor over the whole barrel, AK-like receiver, skeletal wooden stock, 10-round box magazine). Three new calibres (7.62x25 Tokarev, 7.92x57 Mauser, 9x39) with their numbers, cartridge sizes and ammunition loads; the VSS carries the integral suppressor and its subsonic noise. Real numbers and sources in `tools/weapons-catalog/decisions.json` (`creations`, `calibers`, `archetypes`); the models are `weaponModels` decisions with the new `ppsh`, `kar98`, `mg42` and `vss` builders, and the new `beech` material. The three new calibres reuse existing gunshot profiles. No existing weapon changes.
- 5170e39: First lot, part C: the M32 multiple grenade launcher (Milkor MGL), the M18 smoke grenade, the Semtex charge, the KA-BAR, the katana and brass knuckles.

  - game-weapons: the `m32_mgl` launcher (six 40x46 mm grenades, 778 mm with the stock out and 565 mm folded, 5.3 kg, 75 m/s; launcher family `revolver`); the `smoke_grenade` explosive (`kind: 'smoke'`, no blast, fuse 1.0 to 2.3 s, coloured smoke for 50 to 90 s, new `ExplosiveDef.smoke` carried by the `Detonation`); the `semtex` explosive (500 g, 0.83 kg TNT, remote or about 30 s fuse); the melee weapons `kabar`, `katana` (two-hand) and `brass_knuckles` (harder punch over a smaller contact area than `fists`). Generated data comes from `tools/weapons-catalog` (`multiLaunchers`, `radii`).
  - game-weapons-three: a model of its own for each (`mgl` builder with the swing-out cylinder, front grip, collimator sight and folding stock; new `cylinder` model family that reloads and cycles like a revolver and is held as a long gun, with the support hand on `parts.foreGrip`; `buildHandheldModel` for the melee weapons, with a `support` mark for the second hand; the M18 and Semtex builders next to the other explosives).
  - game-test-room: a burning smoke canister lets out puffs of its colour through the effects world until its filling is spent and tells the host of no explosion; brass knuckles punch with the fists clip and the one-hand punch rule.
  - game-vfx: `semtex` blasts like the C4 (alias).

- 2321c3f: Four weapons of the first lot, part A2, drawn as their photos instead of inheriting another weapon's model: the SIG Sauer P320, HK USP and Walther P99 (new `design` option of the pistol builder: modular or polymer frame with a grip of its own, serrated slides, rails, squared or hooked trigger guard, the USP's external hammer, the P99's strap ridges and dimples) and the Colt Python (new `python` option of the revolver builder: ventilated rib, full-length underlug, walnut checkered grip with medallion, round trigger guard). Existing pistols and revolvers are unchanged; the four are added to the catalogue (creations and model decisions), with goldens, thumbnails and docs.

### Patch Changes

- Updated dependencies [20a6526]
- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [970f192]
- Updated dependencies [d3f6983]
- Updated dependencies [5e7d154]
- Updated dependencies [0ce0b71]
- Updated dependencies [0e47730]
- Updated dependencies [5170e39]
- Updated dependencies [2321c3f]
  - @adatechnology/game-weapons@0.9.0
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-vfx@0.10.0
  - @adatechnology/game-audio@0.9.2
  - @adatechnology/game-floorplan-three@0.10.3
  - @adatechnology/game-items-three@0.7.6
  - @adatechnology/game-vfx-three@0.7.4

## 0.17.1

### Patch Changes

- Updated dependencies [45fd34d]
  - @adatechnology/game-vfx@0.9.0
  - @adatechnology/game-vfx-three@0.7.3

## 0.17.0

### Minor Changes

- 6c569dd: Barrel heat is physical. `WeaponState.heat` is now the barrel temperature above ambient in °C: each round adds `share × muzzle energy / (barrel mass × 490 J/(kg·K))` (the whole shell for a shotgun), the barrel mass is its length times kg per metre of the category divided over the barrels a rotary gun has (`dimensions.barrels`, the M134 has 6; `dimensions.barrelMass` overrides it for a heavy or quick-change barrel), and it cools by Newton's law with `τ = 30 s + 250 s/kg × mass`, integrated exactly. An M4 reaches the warning after about 130 rounds of rapid fire instead of one magazine; a pistol or a bolt rifle at a bolt pace never does. `rules.heat` is now data in °C (`cap` 900, `displayMax` 750, `faultFrom` 350, `faultSpan` 200, `specificHeat`, `barrelShare`, `barrelKilogramsPerMetre`, `barrelFallback`, `cooling`, `visual.smokeFrom` 250 / `smokeSpan` 300 / `glowFrom` 450 / `glowSpan` 300); `perShot`, `decayBase` and `decayPerPoint` left the main rules and live in `rules.heat.gallery`, which `GALLERY_HEAT` sets so the recorded Galeria runs stay reproducible. New exports: `roundsToWarningOf`, `roundsToWarning`, `barrelMassOf`, `coolingTimeConstant`, `decayHeat`. `decayHeat` and `heatPerRound` take the barrel mass. In `game-weapons-three` the viewmodel smoke reads `visual.smokeSpan`, and the test area bench shows the barrel temperature in °C plus the new `rounds_to_warning` metric (rounds to the warning at the weapon's own rate of fire, from cold).
- f876baa: The minigun is carried at the hip, by its handles: a model can name where its hands go (`holdRight`, `holdLeft`) and how the body carries it (`carry: 'hip'`). The M134 names its right spade grip and the carry handle on top; in first person it is held low and to the right (`VIEW_HOLD.hip`, no sights to bring to the eye), in third person at the right hip, outside the body (`BODY_HOLD.hipGrip`). Every other weapon is held as before.
- 49b8d77: The first-person viewmodel, as shooters draw the weapon in the hands. `FIRST_PERSON_LAYER` and `ModuleHost.setViewmodelFov` (game-contracts) give a host a layer it draws over the world with the depth cleared and the lens of the tool. The test room draws it (its world camera leaves the layer out), takes first-person arms of its own (`firstPersonArms`: `createFirstPersonArms` of game-characters-three fits it) whose hands go to the tool's grips, and hides the body's arms from the eye (`setView(mode, camera, { arms: true })`). The weapons module puts the gun in the hands on the layer: held at the hip by kind (`VIEW_HOLD`: long gun, handgun, launcher, a tool in one hand carried point up), drawn through a lens per kind, brought to the eye by the right button (the sights on the line of the eye), with the sway behind the turn of the view and the bob of the step (`VIEW_MOTION`); the flash, the smoke, the casings and the tracer leave the muzzle as drawn (`toWorldLens`). The kick of a shot now comes back: 70 % of each kick returns within about a quarter of a second (`recoilReturn` of the room's player). Third person is unchanged: the body shoulders the gun.

### Patch Changes

- a92327a: The muzzle flash and the tracer leave the tip of the barrel as the screen shows it, in both views, at the hip and aimed, a shot or a burst. The flash was played on the clip's event, before the frame posed the gun with its kick, and the tracer stayed where the round left while the kick moved the gun away (13 to 70 px on screen, more in a burst). The flash is now played once the clips have posed the gun (`FxWorld.afterPose`), and a tracer from a muzzle a module draws keeps its start on that muzzle while it lives. `muzzle-screen.test.ts` measures every firearm with a model and fails past 6 px.
- Updated dependencies [6c569dd]
- Updated dependencies [49b8d77]
  - @adatechnology/game-weapons@0.8.0
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-items-three@0.7.5
  - @adatechnology/game-audio@0.9.1
  - @adatechnology/game-floorplan-three@0.10.2
  - @adatechnology/game-vfx-three@0.7.2

## 0.16.0

### Minor Changes

- 9a44330: Synthesized sounds measured from the recordings. `@adatechnology/game-audio/fitted` holds the fitted copy of every recorded sound but the vehicles (band gain curves and ringing partials per take, measured by `tools/sfx-sources/fit.mjs`), and `registerFittedSounds(engine)` puts them in place of the older hand-made recipes of the same ids, so a door, a shot or a footstep stays close to its recording where the files are missing or still loading. The test room registers them; the weapons play the fitted shot, reload step and case under the recorded id (`played.kind === 'fitted'`) instead of the synthesized layers until the files load.

  The kit ships its default recorded sounds again: the 1050 CC0 and CC-BY takes in `@adatechnology/game-audio/assets/sfx/<categoria>/` (credits in `CREDITOS.md`), and `pointSamples(engine, files, { baseUrl })` lets a game play its own files for any id (the id keeps the kit's numbers) without touching the kit. Git takes only the manifest's CC0 and CC-BY files there.

### Patch Changes

- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-floorplan-three@0.10.1
  - @adatechnology/game-items-three@0.7.4
  - @adatechnology/game-vfx-three@0.7.1
  - @adatechnology/game-weapons@0.7.1

## 0.15.0

### Minor Changes

- d9f3302: The shot leaves the muzzle of the weapon drawn in the hands. `ModuleHost.setMuzzleSource` (with `MuzzlePose` and `MuzzleSource`) lends the host the muzzle of the tool the module draws: the weapons module gives the `muzzle` mark of the gallery model (or the front end of the generic prop, where a flame or an extinguisher's foam also leaves), and the test room starts the tracers there and, when the module draws its own muzzle flash, draws none of its own. Before, the room flashed and drew its tracers from a fixed point ahead of the eye, away from the weapon, while the module flashed at the real muzzle.
- 0e1bb14: Every gun closes the view in when it aims, not only one with a scope. `rules.aim.ironSightZoom` gives the iron-sight zoom of each weapon category (1.1x for a handgun up to 1.4x for a marksman or sniper rifle with no optic) and `aimZoomOf(arsenal, weapon, attachments)` answers the zoom of a weapon: the optic fitted (the AUG's integral 1.5x, an ACOG 4x), else the iron sights of its category. The right mouse button of the weapons area aims every firearm and launcher by it.
- 9e84e19: The gun in the first-person view is held at the hip instead of shouldered beside the eye. The view's own pose (`VIEW_HOLD`, used when the host says the view is the player's eye: `firstPerson`, which the weapons area reads from `ModuleHost.player().cameraMode`) puts the grip low and right where the right hand reaches, a handgun's higher and nearer the middle and a rocket launcher's on the shoulder, with the barrel parallel to the aim, so the sights stay below the crosshair and the muzzle points at it. The body still shoulders the gun in third person. The test room reports its real camera mode to the modules (it always said `first`).
- e507329: The weapon picker. `weaponMenu(arsenal)` lists the whole arsenal by group (firearms, melee weapons, explosives, tools) and category, sorted by name and with each brand weapon's maker; `genericWeapons` and `realLoadout` name the generic guns (the `9 mm service pistol`) and the real weapon that stands for each. The test room opens the picker with the key left of 1 (or its Armas button): a click equips the weapon and adds it to the hotbar, a search finds a weapon by name or maker in every group, and the default hotbar holds the real weapons instead of the generic guns.

  The explosives of the weapons gallery are ported (`buildExplosiveModel`: the M67, the molotov, the pipe bomb, the dynamite, the C4, the Claymore and the flashbang), so the throwables are drawn with their own model in the hands, on the counters and in flight (`projectileModel`) instead of the box of the generic prop. The M79 gets the gallery's model with a break action that folds down to load one grenade, a grenade launcher no longer fires a rocket's backblast, the claw hammer takes the item model of the hammer, and the pt-BR names of the weapons that showed in English are translated.

### Patch Changes

- 61a4a79: Cover counts in a blast's push as it stood when the blast went off, and for light things too. `blastShove` takes the cover's share off the speed after the cap (`sqrt(reach) * min(maxSpeed, ...)`): a bottle behind a kitchen cupboard was thrown at the cap like one in the open, since a P13 gives a 0.5 kg body far more than the cap; in the open nothing changes. The destruction renderer reads the cover of each piece and shoveable body when a part of the world goes off, before the blast tears the cupboard apart or throws the stove into the line. The P13 push scenario reads the cover at the same moment and at the middle of what is drawn of each body, and bounds what a sheltered body may move by its share of what one of its kind went in the open nearer the blast.
- be1b538: The recorded shots and reload steps load as a weapon comes to the hands, so the first shot after the page opens already plays its recording instead of the synthesized sound.
- Updated dependencies [8c11843]
- Updated dependencies [fb985db]
- Updated dependencies [6c3877d]
- Updated dependencies [d9f3302]
- Updated dependencies [e0aaf22]
- Updated dependencies [61a4a79]
- Updated dependencies [f362db3]
- Updated dependencies [54a1bcb]
- Updated dependencies [63adb4c]
- Updated dependencies [0e1bb14]
- Updated dependencies [bf407ec]
- Updated dependencies [1a5d6fc]
- Updated dependencies [e507329]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-floorplan-three@0.10.0
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-vfx@0.8.0
  - @adatechnology/game-vfx-three@0.7.0
  - @adatechnology/game-weapons@0.7.0
  - @adatechnology/game-audio@0.8.0
  - @adatechnology/game-items-three@0.7.3

## 0.14.2

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.14.1

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0
  - @adatechnology/game-vfx-three@0.6.0
  - @adatechnology/game-floorplan-three@0.9.3

## 0.14.0

### Minor Changes

- 8f07024: A blast pushes a body by its blast wave, not by a game coupling. `blast-impulse` reads the impulse of the wave (Kinney and Graham's side-on impulse, reflected on the body) from the charge in kg of TNT and the distance. `knockOf` takes the body's area and mass, so a hand grenade at 3 m moves a person a few tenths of a metre per second and a big charge close throws them. A body inside the lethal radius that the blast reaches falls where it stands, wounded, and lies longer. Cover that stops half the blast stops the fragments too. A body in reach is stunned, and the player's view sways while stunned.

  Each explosive of the arsenal gives its charge (`ExplosiveDef.tnt`: M67 0.24 kg, C4 0.76 kg, P13 1.5 kg, and so on). The charge travels on the detonation, the `explodes` spec, the destruction `explode` event and the host `explosion` event (`tnt`, `lethalRadius`). A blast without a charge takes one from its energy at the arsenal's scale. The horde keeps its own shove.

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-weapons@0.6.0
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-floorplan-three@0.9.2
  - @adatechnology/game-items-three@0.7.2
  - @adatechnology/game-vfx-three@0.5.2

## 0.13.1

### Patch Changes

- 6b44b4e: Sons do dono fora do git: `loadUserSamples` registra os arquivos convertidos por `sfx:user` (em `.sfx-local/`, a partir de `user-sounds/picks.json`). Onde o SDK não tem gravação toca o do dono; onde tem, o SDK toca primeiro e o do dono fica de reserva (e em `user:<id>`). O painel de som mostra a fonte do que tocou (SDK, seu som, sintetizado) e ganha "Tocar o seu"; o catálogo ganha os usos novos (rajada .45, sacar, supressor, granada quicando, C4, passos em azulejo/grade/água/duto, escada, nadar, zumbis, helicóptero).
- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.13.0

### Minor Changes

- 672f918: Recorded firearm sounds: 231 takes cut from The Free Firearm Sound Library (CC0), the Restrained Firearms Soundpack and the Oculus Audio Pack 1 (CC BY 4.0) by `tools/sfx-sources/cut.mjs`. A shot plays the near and mid-distance takes of its calibre profile with a crossover by distance; each reload step plays its recording in the tier of the weapon's weight; a case's first bounce plays the recorded floor. Without the files the synthesized sounds play. `AnimationEventSpec.lead` fires a sound event early by real seconds, so the measured hit of each recording (`reload-sample-hits.json`) lands on the frame the part reaches its stop.

### Patch Changes

- Updated dependencies [4dce01e]
- Updated dependencies [fb6d690]
- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [784a6b0]
- Updated dependencies [5d614c6]
- Updated dependencies [29782fc]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
- Updated dependencies [4145cc9]
  - @adatechnology/game-audio@0.5.0
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-shapes-three@0.3.1
  - @adatechnology/game-floorplan-three@0.9.1
  - @adatechnology/game-items-three@0.7.1
  - @adatechnology/game-vfx-three@0.5.1
  - @adatechnology/game-weapons@0.5.9

## 0.12.0

### Minor Changes

- d97cf9f: Firearm sounds: a layered gunshot per calibre family (crack, blast, body, action, room or field tail, far boom) with 4 takes that never repeat back to back, ±4 % pitch, stereo side from the shooter, the arrival delay of sound (d / 343 s), a close-to-far crossfade at 25–80 m (a rifle still carries at 800 m), occlusion, indoor vs outdoor tails and a suppressor that keeps a supersonic crack. Cases landing sound by floor (concrete, wood, metal, dirt) and case type (pistol, rifle, shotgun hull); a bullet passing by cracks (supersonic) or whizzes (subsonic). The game's single burst stays as `shotModel: 'game'`. `ModuleHost.surfaceAt` gives the floor material; the room fills it from the terrain. The weapons area logs each shot sound and each case, and has a "shot indoors" control.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.
- 455522d: `game-weapons-three` takes the item models by option (spec 005, D1 and D2): `items` on `createWeaponFx`, `createWeaponsTestModule`, `createExplosivesTestModule`, `buildWeaponModel`, `buildItemWeaponModel`, `itemModelOfWeapon` and `worldExplosiveItem`. Without `items` the weapons still draw with `itemModels` of `game-items-three`, as before; that default is deprecated and will be removed in the next major, and `game-items-three` stays a dependency until then. `game-items-three` exports `itemModels`, the value to pass.
- e0cddcd: `ViewmodelOptions.particleLimit` (spec 005, A9): the host's cap on casings and magazines alive at once, read at each spawn. Without it the 900 cap stands.
- be7bae5: Weapon props by instance (spec 005, D5): `createWeaponProps({ packs, patch, remove })` returns a set (`register`, `get`, `itemModelOf`, `buildItemModel`, `buildModel`) with the item model overrides of the weapons, shared with no other set. `defaultWeaponProps()` is the set behind `registerWeaponItemModel`, `itemModelOfWeapon`, `buildItemWeaponModel` and `buildWeaponModel`, which stay exported and `@deprecated` with the same results. The test area and `buildModeledProp` still read the default set.

### Patch Changes

- fab813c: Silent fallbacks now say so (spec 005, review item 12). `warnOnce(key, message)` in `game-contracts` warns once per key on the console, outside production. `createDestructionRenderer` and `createFluidRenderer` without `vfx`, `createViewmodel` (and `createWeaponFx`) without `effects` and `createWeaponAudio` without `engine` keep working with a world or engine of their own and warn once. The weapons test module makes its own audio only when it is first needed, so a room that lends the engine never triggers the warning.
- Updated dependencies [ce94d04]
- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [cbb20a2]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [57c5a6f]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
- Updated dependencies [65ccb0c]
- Updated dependencies [455522d]
  - @adatechnology/game-floorplan-three@0.9.0
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-items-three@0.7.0
  - @adatechnology/game-vfx-three@0.5.0
  - @adatechnology/game-vfx@0.7.0
  - @adatechnology/game-weapons@0.5.8

## 0.11.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vfx@0.6.0
  - @adatechnology/game-vfx-three@0.4.0
  - @adatechnology/game-items-three@0.6.2
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-floorplan-three@0.8.3
  - @adatechnology/game-interactables-three@0.1.15
  - @adatechnology/game-weapons@0.5.7

## 0.11.2

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-items-three@0.6.1
  - @adatechnology/game-floorplan-three@0.8.2

## 0.11.1

### Patch Changes

- d28e38f: The hands always take the tool's scale (they shrank only to `scale ** 0.55`, so a weapon drawn smaller looked like a toy in them), and the wall pull reaches the weapon's own length when it is longer than `WALL_PULL.max`. A test fails when the hands and the weapon in first person are drawn at different scales.

## 0.11.0

### Minor Changes

- f8c2b21: Third person draws the weapon on the body at its real size: new optional `ModuleHost.holdFrame()` (the pocket of the right shoulder turned to the aim; null in first person), which the test room lends from the avatar's new `shoulder(side)`. The weapons viewmodel puts a long gun's stock in the pocket (a launcher slides back until its grip is in reach), a handgun or a one-hand tool at a ready grip, and caps the support hand's span at 0.5 m. Looking up or down no longer drives the arms into the body.
- 3642202: The weapon in the hands is the body's own, at its real size, in first and third person: no first-person scale-down and no offset in front of the camera. `holdFrame` (the pocket of the right shoulder) now answers in both views, and a host with no body gets the same pocket under the camera's eye. A gun with no stock slides forward so its grip is never behind the eye, a short two-hand gun is held at mid-chest, the grips of both hands stay above the bottom of the view (`HAND_IN_VIEW`, up to 0.3 m) and the weapon comes back from a wall (`WALL_PULL`, up to 1.2 m). The generic props ride the body too. The player's body no longer stops the weapon's contact and laser rays. The support arm's elbow tucks under the gun, so the forearm meets the handguard at 47 to 51 degrees off the aim.

### Patch Changes

- 3c97ac5: The explosives push scenario logs a person's row as plain numbers (kind, distance, outward) instead of the whole placed body, whose three.js objects made the room's behaviour log fail to serialise.
- 7d12878: The push scenarios leave a heavy piece of furniture the blast tore apart out of "every body moved outward" (its root can meet its own pieces in the air) while still checking that it moved, and the grenade's zombie lies off the line of every loose thing.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [b8d2a17]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-items-three@0.6.0
  - @adatechnology/game-floorplan-three@0.8.0
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-interactables-three@0.1.14
  - @adatechnology/game-vfx-three@0.3.6
  - @adatechnology/game-weapons@0.5.6

## 0.10.4

### Patch Changes

- Updated dependencies [3df0096]
  - @adatechnology/game-items-three@0.5.0

## 0.10.3

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-floorplan-three@0.7.0
  - @adatechnology/game-vfx@0.5.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-interactables-three@0.1.13
  - @adatechnology/game-items-three@0.4.1
  - @adatechnology/game-vfx-three@0.3.5
  - @adatechnology/game-weapons@0.5.5

## 0.10.2

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [31fc87d]
- Updated dependencies [3aec7f3]
- Updated dependencies [31fc87d]
  - @adatechnology/game-items-three@0.4.0
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-floorplan-three@0.6.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-vfx-three@0.3.4
  - @adatechnology/game-interactables-three@0.1.12
  - @adatechnology/game-vfx@0.4.4
  - @adatechnology/game-weapons@0.5.4

## 0.10.1

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-floorplan-three@0.5.0
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-interactables-three@0.1.11
  - @adatechnology/game-items-three@0.3.2
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3
  - @adatechnology/game-weapons@0.5.3

## 0.10.0

### Minor Changes

- 04d7e14: Safety animation (destravar): every weapon model now plays `safety_on` / `safety_off` with the weapon canting toward the eye, the shooting hand's thumb going to the lever (the support hand on the right-side lever of AK-style rifles) and the lever flicking, instead of a 0.12 s turn of the lever on the few models that drew one.

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-items-three@0.3.1
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-floorplan-three@0.4.2
  - @adatechnology/game-interactables-three@0.1.10
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2
  - @adatechnology/game-weapons@0.5.2

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
