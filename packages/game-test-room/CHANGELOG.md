# @adatechnology/game-test-room

## 0.31.0

### Minor Changes

- 89f1d9d: Sound occlusion: `createAudioEngine({ occlusion: { query } })` asks the host what lies between a sound and the ears (material and thickness, or a loss in dB), adds the transmission loss of the hits (`TRANSMISSION_LOSS`, a table of real values a game patches: 12 cm brick about 42 dB, concrete 48, drywall 33, wooden door 22, glass 27, open doorway 0, the mass law for other thicknesses) up to a configurable cap so a sound that gets around an edge never drops to silence, and plays each positioned voice through its own gain and lowpass (highs lose more). Voices are re-queried as the listener moves, at a limited rate and within a per-update budget, only while audible, and the gain and cutoff glide with `setTargetAtTime`. `occludedVoices()` reports the numbers. The old `(point) => 0..1` callback still works. The test room hands its engine a query that crosses its destruction world (`createWorldOcclusion`): the part's material, and its thickness from the way in and the way out.

### Patch Changes

- Updated dependencies [89f1d9d]
  - @adatechnology/game-audio@0.11.0
  - @adatechnology/game-destruction-three@0.19.1

## 0.30.2

### Patch Changes

- Updated dependencies [baaa7d4]
- Updated dependencies [694cad8]
  - @adatechnology/game-audio@0.10.0
  - @adatechnology/game-destruction-three@0.19.0
  - @adatechnology/game-weapons@0.10.0

## 0.30.1

### Patch Changes

- Updated dependencies [67edc92]
  - @adatechnology/game-destruction@0.21.0
  - @adatechnology/game-destruction-three@0.18.2

## 0.30.0

### Minor Changes

- c4b8218: The photo of the real weapon is now a small thumbnail in the bottom-left corner of the weapons room, opening large (with author, licence and the Wikimedia link) on a click, instead of a big card on the bench panel. `ModuleHost.cornerImage` (contracts) and the room's corner image with lightbox (test-room) are generic; the weapons module shows the photo only with the new `referencePhotos` option (default off, so the general test room shows none). The showcase no longer sends a bench sheet.

### Patch Changes

- Updated dependencies [3d53e28]
- Updated dependencies [c4b8218]
- Updated dependencies [a6a6a8f]
- Updated dependencies [49272b6]
- Updated dependencies [5ce9f7b]
- Updated dependencies [fa57abb]
  - @adatechnology/game-terrain@0.6.0
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-destruction@0.20.0
  - @adatechnology/game-audio@0.9.4
  - @adatechnology/game-terrain-three@0.5.4
  - @adatechnology/game-destruction-three@0.18.1
  - @adatechnology/game-fluids@0.5.5
  - @adatechnology/game-fluids-three@0.4.18
  - @adatechnology/game-player@0.5.8
  - @adatechnology/game-runtime@0.2.8
  - @adatechnology/game-vfx-three@0.7.6
  - @adatechnology/game-weapons@0.9.2

## 0.29.1

### Patch Changes

- 41760ac: Broken objects: nothing floats, nothing invisible collides. After each break the renderer checks what is left of the object on the next update (`onBrokenChecked`)
  and lets go at once what stood on something and lost it; whatever is not a structure loses its footing by the same rule as furniture. What lay asleep on a piece
  wakes in the same update that piece starts to move. `shownBoxes(objectId, partId?)` gives the world boxes of what is still drawn. The test room measures the player
  against those boxes (a broken leg leaves no collider), logs a `broken_floating` failure when the check had to let something go, and looks for what a thrown body
  hit from the hip to the shoulder. The floor plan's golden hashes of the two house destruction scenes change: debris asleep on pieces that move now wakes.
- Updated dependencies [a3b0fd7]
- Updated dependencies [41760ac]
- Updated dependencies [e8cae79]
- Updated dependencies [3894641]
- Updated dependencies [148cbbb]
- Updated dependencies [8976efa]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-destruction-three@0.18.0
  - @adatechnology/game-vfx-three@0.7.5
  - @adatechnology/game-vfx@0.10.1
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-terrain@0.5.2
  - @adatechnology/game-audio@0.9.3
  - @adatechnology/game-fluids@0.5.4
  - @adatechnology/game-fluids-three@0.4.17
  - @adatechnology/game-player@0.5.7
  - @adatechnology/game-runtime@0.2.7
  - @adatechnology/game-terrain-three@0.5.3
  - @adatechnology/game-weapons@0.9.1

## 0.29.0

### Minor Changes

- 624ee79: A weapon in each hand, finished. The magazine change frees a hand as a person does: the other weapon is tucked in the belt (`rules.dualWield.stowSeconds`, 0.45 s), the free hand goes to the magazine well of the weapon being reloaded and back, the weapon is drawn again, then the same the other way round; neither weapon fires meanwhile. The contracts gain `HostTool.stowed`, the `stow` host event and `HandTargets.fingersL` (the left hand's index finger, as `fingers` is the right's); the first-person arms and the player's body curl each index finger by it (the body's right index now follows `fingers` too). Q (fire mode) and B (safety) act on the weapon of the hand that fired last, and X clears the stuck weapon (the last-fired one first).
- b6677b5: A weapon in each hand. `rules.dualWield` of the arsenal says which weapons go one in each hand (the pistols and revolvers by category, the Mini Uzi, Uzi, MAC-10, vz. 61, MP7 and the knives, machete and hatchet by id; a game changes the lists) and how much worse each one shoots then (`spread` 1.8x, `recoil` 1.35x); `canDualWield(arsenal, id)` answers it, and `setStance({ dualWield: true })` applies it and keeps the weapon from aiming. The contracts gain `ToolHand`, `HostTool.offHand` (the left hand's tool, with its own rounds and reload), `hand` on the tool events, a `MuzzleSource` and a `holdFrame` asked by hand. The weapon module draws the left hand's weapon out to the left, the left hand on the mirror of its grip, in both views (`VIEW_HOLD.dual`, `BODY_HOLD.dualGrip`, `oneHandHold`; a stock is folded while held in one hand), and lends each hand's muzzle, so each shot's flash and tracer leave its own gun. The test room: Shift+click in the weapon picker puts two of an eligible weapon in the hands (a second Shift+click changes the left one, a plain click goes back to one); the left mouse button fires the right hand, the right button the left hand (no aiming with two); R reloads the right one, then the left one; `room.setOffTool`, `room.offTool`, `room.useOff` and `room.reload`.
- d3f6983: `assets/weapon-references.json`: a photo of the real weapon for each weapon of the arsenal, to compare each model with (123 of 141). Each one is a free Wikimedia Commons file (the image stays on the Commons servers) with its author, licence and page. A file a person checked is pinned (`pinned`, the G36C is not the G36); a weapon with no free photo of its exact model is listed in `missing` instead of borrowing another's. The weapon-thumbnails tool writes it (`node dist/cli.js references`).

  The weapons area gets a showcase: the `showcase_weapon` control puts any weapon with a model on a pedestal (the buffet of the furniture catalogue) behind the counters, turning slowly (`showcase_spin`), takes the camera close to it (`showcase_look`) and shows the photo of the real one with its author and licence, so the model can be compared with it.

  `BenchSheet.image` (game-contracts): a picture of the real thing a sheet is about, with its credit and page; the test room shows it over the scene, top centre, linked to its page.

- 5170e39: First lot, part C: the M32 multiple grenade launcher (Milkor MGL), the M18 smoke grenade, the Semtex charge, the KA-BAR, the katana and brass knuckles.

  - game-weapons: the `m32_mgl` launcher (six 40x46 mm grenades, 778 mm with the stock out and 565 mm folded, 5.3 kg, 75 m/s; launcher family `revolver`); the `smoke_grenade` explosive (`kind: 'smoke'`, no blast, fuse 1.0 to 2.3 s, coloured smoke for 50 to 90 s, new `ExplosiveDef.smoke` carried by the `Detonation`); the `semtex` explosive (500 g, 0.83 kg TNT, remote or about 30 s fuse); the melee weapons `kabar`, `katana` (two-hand) and `brass_knuckles` (harder punch over a smaller contact area than `fists`). Generated data comes from `tools/weapons-catalog` (`multiLaunchers`, `radii`).
  - game-weapons-three: a model of its own for each (`mgl` builder with the swing-out cylinder, front grip, collimator sight and folding stock; new `cylinder` model family that reloads and cycles like a revolver and is held as a long gun, with the support hand on `parts.foreGrip`; `buildHandheldModel` for the melee weapons, with a `support` mark for the second hand; the M18 and Semtex builders next to the other explosives).
  - game-test-room: a burning smoke canister lets out puffs of its colour through the effects world until its filling is spent and tells the host of no explosion; brass knuckles punch with the fists clip and the one-hand punch rule.
  - game-vfx: `semtex` blasts like the C4 (alias).

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
  - @adatechnology/game-destruction@0.18.2
  - @adatechnology/game-audio@0.9.2
  - @adatechnology/game-destruction-three@0.17.3
  - @adatechnology/game-fluids@0.5.3
  - @adatechnology/game-fluids-three@0.4.16
  - @adatechnology/game-player@0.5.6
  - @adatechnology/game-runtime@0.2.6
  - @adatechnology/game-terrain@0.5.1
  - @adatechnology/game-terrain-three@0.5.2
  - @adatechnology/game-vfx-three@0.7.4

## 0.28.2

### Patch Changes

- 018c556: `terrain.bear(loads)`: weight standing still on bare bars bends them, weights over the same hole add up, and a slab over a void gives way under what its bars cannot hold. The test room hands it the player and every resting piece.
- Updated dependencies [018c556]
  - @adatechnology/game-terrain@0.5.0
  - @adatechnology/game-terrain-three@0.5.1

## 0.28.1

### Patch Changes

- 45fd34d: Bare rock (`bedrock`) as a ground of its own, with a lot in the test room; the HUD names every ground profile. `cratersAt` of the effects: on rock, asphalt or a slab a blast leaves only soot, not a dirt crater.
- Updated dependencies [45fd34d]
  - @adatechnology/game-terrain@0.4.0
  - @adatechnology/game-terrain-three@0.5.0
  - @adatechnology/game-vfx@0.9.0
  - @adatechnology/game-destruction-three@0.17.2
  - @adatechnology/game-fluids-three@0.4.15
  - @adatechnology/game-vfx-three@0.7.3

## 0.28.0

### Minor Changes

- 49b8d77: The first-person viewmodel, as shooters draw the weapon in the hands. `FIRST_PERSON_LAYER` and `ModuleHost.setViewmodelFov` (game-contracts) give a host a layer it draws over the world with the depth cleared and the lens of the tool. The test room draws it (its world camera leaves the layer out), takes first-person arms of its own (`firstPersonArms`: `createFirstPersonArms` of game-characters-three fits it) whose hands go to the tool's grips, and hides the body's arms from the eye (`setView(mode, camera, { arms: true })`). The weapons module puts the gun in the hands on the layer: held at the hip by kind (`VIEW_HOLD`: long gun, handgun, launcher, a tool in one hand carried point up), drawn through a lens per kind, brought to the eye by the right button (the sights on the line of the eye), with the sway behind the turn of the view and the bob of the step (`VIEW_MOTION`); the flash, the smoke, the casings and the tracer leave the muzzle as drawn (`toWorldLens`). The kick of a shot now comes back: 70 % of each kick returns within about a quarter of a second (`recoilReturn` of the room's player). Third person is unchanged: the body shoulders the gun.

### Patch Changes

- a92327a: The muzzle flash and the tracer leave the tip of the barrel as the screen shows it, in both views, at the hip and aimed, a shot or a burst. The flash was played on the clip's event, before the frame posed the gun with its kick, and the tracer stayed where the round left while the kick moved the gun away (13 to 70 px on screen, more in a burst). The flash is now played once the clips have posed the gun (`FxWorld.afterPose`), and a tracer from a muzzle a module draws keeps its start on that muzzle while it lives. `muzzle-screen.test.ts` measures every firearm with a model and fails past 6 px.
- Updated dependencies [6c569dd]
- Updated dependencies [49b8d77]
  - @adatechnology/game-weapons@0.8.0
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1
  - @adatechnology/game-audio@0.9.1
  - @adatechnology/game-destruction-three@0.17.1
  - @adatechnology/game-fluids@0.5.2
  - @adatechnology/game-fluids-three@0.4.14
  - @adatechnology/game-player@0.5.5
  - @adatechnology/game-runtime@0.2.5
  - @adatechnology/game-terrain@0.3.2
  - @adatechnology/game-terrain-three@0.4.2
  - @adatechnology/game-vfx-three@0.7.2

## 0.27.0

### Minor Changes

- 9a44330: Synthesized sounds measured from the recordings. `@adatechnology/game-audio/fitted` holds the fitted copy of every recorded sound but the vehicles (band gain curves and ringing partials per take, measured by `tools/sfx-sources/fit.mjs`), and `registerFittedSounds(engine)` puts them in place of the older hand-made recipes of the same ids, so a door, a shot or a footstep stays close to its recording where the files are missing or still loading. The test room registers them; the weapons play the fitted shot, reload step and case under the recorded id (`played.kind === 'fitted'`) instead of the synthesized layers until the files load.

  The kit ships its default recorded sounds again: the 1050 CC0 and CC-BY takes in `@adatechnology/game-audio/assets/sfx/<categoria>/` (credits in `CREDITOS.md`), and `pointSamples(engine, files, { baseUrl })` lets a game play its own files for any id (the id keeps the kit's numbers) without touching the kit. Git takes only the manifest's CC0 and CC-BY files there.

### Patch Changes

- 2933abd: `impactSoundIds()` lists every sound a blow, ricochet or break on a material plays; the test room preloads them on the first key or click, so the first ricochet off a wall plays the recording instead of the synthesized recipe.
- Updated dependencies [dbc0ef3]
- Updated dependencies [2933abd]
- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-destruction-three@0.17.0
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-terrain@0.3.1
  - @adatechnology/game-fluids@0.5.1
  - @adatechnology/game-fluids-three@0.4.13
  - @adatechnology/game-player@0.5.4
  - @adatechnology/game-runtime@0.2.4
  - @adatechnology/game-terrain-three@0.4.1
  - @adatechnology/game-vfx-three@0.7.1
  - @adatechnology/game-weapons@0.7.1

## 0.26.0

### Minor Changes

- 8c11843: The first shot or blast on a wall no longer builds shader programs in play. `wallPiece` gives `warmUpProbes(THREE)`: the wall drawn with one brick shot out of it (the breach's shell and its bare bricks, instanced, lit and in the shadows), for a host to draw once at load; its `dispose` frees geometries and textures and leaves the materials to the host's warmup, which keeps the programs alive. A room's `SceneryObject` takes `warmUpProbes`, and the room draws them with its other probes; the test room passes the target wall's.
- d9f3302: The shot leaves the muzzle of the weapon drawn in the hands. `ModuleHost.setMuzzleSource` (with `MuzzlePose` and `MuzzleSource`) lends the host the muzzle of the tool the module draws: the weapons module gives the `muzzle` mark of the gallery model (or the front end of the generic prop, where a flame or an extinguisher's foam also leaves), and the test room starts the tracers there and, when the module draws its own muzzle flash, draws none of its own. Before, the room flashed and drew its tracers from a fixed point ahead of the eye, away from the weapon, while the module flashed at the real muzzle.
- e507329: The weapon picker. `weaponMenu(arsenal)` lists the whole arsenal by group (firearms, melee weapons, explosives, tools) and category, sorted by name and with each brand weapon's maker; `genericWeapons` and `realLoadout` name the generic guns (the `9 mm service pistol`) and the real weapon that stands for each. The test room opens the picker with the key left of 1 (or its Armas button): a click equips the weapon and adds it to the hotbar, a search finds a weapon by name or maker in every group, and the default hotbar holds the real weapons instead of the generic guns.

  The explosives of the weapons gallery are ported (`buildExplosiveModel`: the M67, the molotov, the pipe bomb, the dynamite, the C4, the Claymore and the flashbang), so the throwables are drawn with their own model in the hands, on the counters and in flight (`projectileModel`) instead of the box of the generic prop. The M79 gets the gallery's model with a break action that folds down to load one grenade, a grenade launcher no longer fires a rocket's backblast, the claw hammer takes the item model of the hammer, and the pt-BR names of the weapons that showed in English are translated.

- 78e76b0: More grounds to stand on, each with its own answer to a blow: mud, gravel, dry clay, snow, cobblestones, concrete pavers and shallow water. The room's default page lays a lot of every ground with its sign. Fixes the player standing twice as deep in a hole and twice as high on a heap.

### Patch Changes

- 63adb4c: The hand foley of the test room plays the recorded takes: `KIT_SAMPLE_ALIASES` points `door_wood_close` and `door_wood_slam` at the wooden door shut and slam files and the item pickups (metal, plastic, glass, wood, fabric) at the pickup files, and the room preloads those ids (`HAND_RECORDED_IDS`) on the first key or click. Taking an item now plays one sound, the item's class: the second `grab_*` sound that played with it at the same moment is gone.
- 9e84e19: The gun in the first-person view is held at the hip instead of shouldered beside the eye. The view's own pose (`VIEW_HOLD`, used when the host says the view is the player's eye: `firstPerson`, which the weapons area reads from `ModuleHost.player().cameraMode`) puts the grip low and right where the right hand reaches, a handgun's higher and nearer the middle and a rocket launcher's on the shoulder, with the barrel parallel to the aim, so the sights stay below the crosshair and the muzzle points at it. The body still shoulders the gun in third person. The test room reports its real camera mode to the modules (it always said `first`).
- 78f764d: A body thrown into something finds what stopped it: the slam's ray reaches the far side of the footprint just ahead (a steel sheet on its stand stopped the body 0.6 m from the panel, past the fixed 0.65 m reach by one walk step) and, when it misses at the shoulder or the hip, sweeps the footprint's height (the panel floats above the hip once the blast has taken its posts). Before, whether the slam named the wall depended on how much of the blast's destruction the frame budget had applied when the body arrived, so it changed with the machine and the Node version.
- 296efd7: What lay on a support that is gone falls. A sleeping piece looks under it again, a few each update in turn, and wakes when none of its lowest points has the ground,
  a piece or a fixed top under it (the cans on a table whose legs broke, a book on a shelf that fell over); a fragment asleep over a ground that dropped does the same.
  Furniture that lost the parts it stood on is loose: with every leg broken the top comes down, with the legs of one end gone it goes over, and a piece that lost a part
  is the box of what is left of it. In the test room, a module's counter that became a piece no longer holds things up where it stood.
- Updated dependencies [fb985db]
- Updated dependencies [6c3877d]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [e0aaf22]
- Updated dependencies [61a4a79]
- Updated dependencies [54a1bcb]
- Updated dependencies [e587c5d]
- Updated dependencies [63adb4c]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [0e1bb14]
- Updated dependencies [bf407ec]
- Updated dependencies [e59b4d4]
- Updated dependencies [e507329]
- Updated dependencies [296efd7]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0
  - @adatechnology/game-destruction-three@0.16.0
  - @adatechnology/game-terrain@0.3.0
  - @adatechnology/game-vfx@0.8.0
  - @adatechnology/game-vfx-three@0.7.0
  - @adatechnology/game-weapons@0.7.0
  - @adatechnology/game-audio@0.8.0
  - @adatechnology/game-terrain-three@0.4.0
  - @adatechnology/game-fluids@0.5.0
  - @adatechnology/game-fluids-three@0.4.12
  - @adatechnology/game-player@0.5.3
  - @adatechnology/game-runtime@0.2.3

## 0.25.2

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0
  - @adatechnology/game-destruction-three@0.15.4

## 0.25.1

### Patch Changes

- 157b90d: The warmup draws each effect alone: `EffectWarmup.root` names the subtree the effect draws under, and for its frames every other drawable of the scene is hidden (lights, and whatever holds one, stay, so the program keys are the game's). `VfxRenderer.root` is the group every effect draws under; the test room passes it for the nine blasts it warms. The room was drawn in full 27 times per warmup only to warm the blasts: the second warmup of the room's load went from 62 s to 17 s with software GL, and the page opens in 71 s instead of 113 s.
- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0
  - @adatechnology/game-vfx-three@0.6.0
  - @adatechnology/game-destruction-three@0.15.3
  - @adatechnology/game-fluids-three@0.4.11

## 0.25.0

### Minor Changes

- 8f07024: A blast pushes a body by its blast wave, not by a game coupling. `blast-impulse` reads the impulse of the wave (Kinney and Graham's side-on impulse, reflected on the body) from the charge in kg of TNT and the distance. `knockOf` takes the body's area and mass, so a hand grenade at 3 m moves a person a few tenths of a metre per second and a big charge close throws them. A body inside the lethal radius that the blast reaches falls where it stands, wounded, and lies longer. Cover that stops half the blast stops the fragments too. A body in reach is stunned, and the player's view sways while stunned.

  Each explosive of the arsenal gives its charge (`ExplosiveDef.tnt`: M67 0.24 kg, C4 0.76 kg, P13 1.5 kg, and so on). The charge travels on the detonation, the `explodes` spec, the destruction `explode` event and the host `explosion` event (`tnt`, `lethalRadius`). A blast without a charge takes one from its energy at the arsenal's scale. The horde keeps its own shove.

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-weapons@0.6.0
  - @adatechnology/game-destruction@0.16.0
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-destruction-three@0.15.2
  - @adatechnology/game-fluids@0.4.4
  - @adatechnology/game-fluids-three@0.4.10
  - @adatechnology/game-player@0.5.2
  - @adatechnology/game-runtime@0.2.2
  - @adatechnology/game-terrain@0.2.3
  - @adatechnology/game-terrain-three@0.3.2
  - @adatechnology/game-vfx-three@0.5.2

## 0.24.0

### Minor Changes

- 6b44b4e: Sons do dono fora do git: `loadUserSamples` registra os arquivos convertidos por `sfx:user` (em `.sfx-local/`, a partir de `user-sounds/picks.json`). Onde o SDK não tem gravação toca o do dono; onde tem, o SDK toca primeiro e o do dono fica de reserva (e em `user:<id>`). O painel de som mostra a fonte do que tocou (SDK, seu som, sintetizado) e ganha "Tocar o seu"; o catálogo ganha os usos novos (rajada .45, sacar, supressor, granada quicando, C4, passos em azulejo/grade/água/duto, escada, nadar, zumbis, helicóptero).

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0
  - @adatechnology/game-destruction-three@0.15.1

## 0.23.0

### Minor Changes

- The body falls the way the blast pushed it: on its back when it faced the blast, face down when the blast was behind it (`AvatarUpdate.fallForward`, `RoomAvatarState.fallForward`, `player.knockedForward`; `toRoomAvatar` passes it on). The first-person view lying face down looks at the ground; on the back, at the sky.

### Patch Changes

- e522e32: Fire sounds by fuel: wood, fabric, plastic/rubber, a gas jet and a pool of fuel each play their own roar (`FIRE_FUEL_OF`, `FIRE_LOOP_OF`, `FIRE_CRACKLE_OF`, recorded loops with synthesized fallbacks); a gas jet and a fuel pool do not crackle. The renderer sends the burning material, a venting vessel burns as gas until it bursts, and `DestructionSound.reset()` puts every fire sound out. The test room gives a molotov's pool and a burning fuel stain the liquid fire sound and resets the fires on clear.
- Updated dependencies [e522e32]
  - @adatechnology/game-destruction-three@0.15.0

## 0.22.0

### Minor Changes

- a27d5ae: A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.
- ebb9479: Foley of the hand. `game-audio` ships `FOLEY_BANK`: doors (wooden, metal, locked rattle, slam), fridge, microwave, drawers, item pickup by material, throw, can and bottle opening, gulps, chewing and first aid, under the ids of the sound list so a recorded take under the same id replaces the synthesised one. Each recipe draws pitch, timing and level from ranges (no two plays alike) and uses `FOLEY_FALLOFF`, which falls off faster and loses its highs with distance. `LEAF_FOLEY_SETS` groups the leaf sounds by kind (`fridge`, `microwave`, `drawer`, `wood_door`, `metal_door`).

  `TestableItem.sounds` (`ItemSounds`) lets an item name its leaf sound set per part, its pickup class, its opening sound and the sound of each use. The household fridges and microwave declare theirs; a vehicle's leaves are left to the vehicle bank (`game-vehicles-three`).

  `createDestructionSound` registers the foley bank and plays a key without a rule that is the id of a registered sound. The test room plays a leaf's set (the item's, else a drawer for a slide, else a metal or wooden door by material; a heavy leaf slams), and now sounds when an item is picked up, thrown, opened (can tab or screw cap) and while it is drunk or eaten. The doors keys `leaf_latch`, `leaf_creak_*`, `leaf_shut_*` and `leaf_rattle` are no longer sent by the room's doors.

- 29782fc: Impact sounds by material and kind of blow. Every destruction event a hit emits carries `blow` (the hit's `DamageType`). The renderer sends `onSound` a
  `detail.keys` list, most specific first (`impact_<material>_<blow>`, `impact_<material>`, `impact_<family>_<blow>`, `impact_<family>`, and `break_*` for
  fractures), before the legacy family key. `impactFamily` gives ceramic, the ground (soil, sand, gravel, turf), plastic, wax and plants their own family.
  `IMPACT_SOUND_KEYS` and `IMPACT_SOUNDS` add a sound for a bullet, a blow and a blade on metal, wood, glass and masonry, and own sounds for thin metal, MDF,
  ceramic, plaster, the ground, plastic, rubber, wax, soft things, paper and plants. The test room passes the keys through, and
  `examples/test-room/sound-audit-impacts.mjs` measures what each material plays for each blow in the real room.
- 4145cc9: Vehicle sounds that follow what the vehicle does. `game-audio`: a loop can carry a `falloff` and `pan`, and `set` takes a `position` (level and side from the listener, duller far away) and a `cutoff` (the first filter); the sink passes `params.cutoff` and the position through. `game-vehicles-three`: `VEHICLE_SOUND_BANK` and `createVehicleSound` — the engine as loops crossfaded by RPM at the firing frequency (car, truck, bike profiles), louder and brighter under load, an RPM guessed through gears for drivers without an engine model, the starter (catching with a flare, or failing), ignition off, tyres squealing on asphalt or hissing on dirt by slip, road noise by speed, crashes light / medium / heavy by speed, and car doors, trunk and hood. The vehicles area turns the key before the lane car pulls away. `game-test-room`: a leaf of an object tagged `vehicle` plays `vehicle_<door|trunk|hood>_<open|shut>`; `game-destruction-three` maps those to the car sounds, falling back to the old latch and metal shut when the vehicle bank is not loaded (`SoundKeyRule.fallback`).

### Patch Changes

- fb6d690: Explosions and fire sound like what happened. `createDestructionSound` plays the family of each explosion from its effect (grenade, big charge, fuel vessel, car, pipe bomb, rocket, flashbang, molotov; `BLAST_KIND_OF`, changeable by option), the far rumble past 60 m and the indoor tail when the blast was confined; fire has its ignition "whoomp" (at most two at once when many parts catch together), a gas leak while a punctured vessel vents, a lower roar and crackles at the burning points (`update(dt)`). The renderer sends the explosion's effect, radius and confinement with `explode` (`SoundDetail`). game-audio adds the `kit` mix (the art scene chain plus a soft limiter with a −1 dBFS ceiling), now the default: a blast with its debris no longer clips the output. The room passes the thrown explosive's id to the renderer and ticks the fire crackles.
  A car's fuel tank names its explosion (`car_fuel_tank`), so it sounds and looks like a car going up.
- 9a151ad: `urgent` on a play (`PlayOptions`, `SoundRequest`): the voice is built at once instead of in the deferred start queue. The body's sounds use it (footsteps, jump, landing, swing, hit): at a low frame rate the queue started the hit of a knife, an axe or a bat 60 to 500 ms late, or dropped it.
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
  - @adatechnology/game-destruction-three@0.14.0
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0
  - @adatechnology/game-shapes-three@0.3.1
  - @adatechnology/game-player@0.5.1
  - @adatechnology/game-fluids@0.4.3
  - @adatechnology/game-fluids-three@0.4.9
  - @adatechnology/game-runtime@0.2.1
  - @adatechnology/game-terrain@0.2.2
  - @adatechnology/game-terrain-three@0.3.1
  - @adatechnology/game-vfx-three@0.5.1
  - @adatechnology/game-weapons@0.5.9

## 0.21.0

### Minor Changes

- 15046ce: Body sounds by action and by floor. `game-contracts` names them (`footstep_<surface>_<walk|run>` on 12 surfaces, `land_<surface>_<light|heavy>`, the swing and the hit of each blow, hurt, bite, grab, body fall) with `surfaceOfMaterial` and the `footfall` host event; `game-audio` answers every id with `BODY_FOLEY_BANK` (four takes each) and adds sound sets (`SoundBank.sets`: a take that never repeats, at ±4% of rate, through `retunePlan`) and `SoundRequest.delay`; `game-player` emits the ids (`sound.ids`, the team class stays in `sound.sound`), reads the floor (`world.surfaceAt`, `input.surface`) and steps on the host's footfalls (`input.footfall`); the player body says when a heel is down (`footfall()`); the test room sends the footfalls, plays the jump and the landing on the floor under the feet, the swing just before the contact and the hit with it.
- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
- d97cf9f: Firearm sounds: a layered gunshot per calibre family (crack, blast, body, action, room or field tail, far boom) with 4 takes that never repeat back to back, ±4 % pitch, stereo side from the shooter, the arrival delay of sound (d / 343 s), a close-to-far crossfade at 25–80 m (a rifle still carries at 800 m), occlusion, indoor vs outdoor tails and a suppressor that keeps a supersonic crack. Cases landing sound by floor (concrete, wood, metal, dirt) and case type (pistol, rifle, shotgun hull); a bullet passing by cracks (supersonic) or whizzes (subsonic). The game's single burst stays as `shotModel: 'game'`. `ModuleHost.surfaceAt` gives the floor material; the room fills it from the terrain. The weapons area logs each shot sound and each case, and has a "shot indoors" control.
- b97f318: Graphics settings for the player. New `@adatechnology/game-graphics` (presets Automático, Baixa, Média, Alta, Ultra; resolution scale, horde detail, shadows, view distance, FPS cap and counter; the automatic mode that moves only what is left on `auto` by the frame time; a 3 s calibration on the first load, kept per GPU; the choice in `localStorage`; the settings screen at `/screen`) and `@adatechnology/game-graphics-three` (pixel ratio, sun shadow and far plane on three.js, GPU name, whole-frame GPU timer). `startLoop` takes `minFrameMs` (a frame cap). `ModuleHost.graphics` (`HostGraphics`) lends the horde detail to modules; the crowd test module fixes its level budgets at that share or keeps `budget.adapt` under auto, and reports its `detailScale`. The test room takes `graphics: true | RoomGraphicsOptions`: a Gráficos button in place of the quality select, the calibration on its loading indicator, `room.graphics` and `room.graphicsScreen`.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 6247fbe: The room shows its memory and warns on screen when it leaks. The counters line adds geometries, textures and the JS heap (`geometries`, `textures`, `heap_mb` in `metrics()`). After each clear the room compares the GPU counts with the earlier clears of the same area: when they grew on each of the last four clears past the budget (40 geometries or 4 textures), a red banner stays under the tool, the log gets a `memory_leak` event and the counters line marks it, until a clear finds the memory back down. New `createMemoryWatch` and `RoomUi.alert`.

  The terrain area frees its strip labels (plane, material and canvas texture) when it closes, and a new lint rule (`kit/no-bare-remove`) fails a `removeFromParent()` in a function that frees nothing.
  The horde bench frees the walls of its scenes when a scene closes.

- 141f296: `TestRoom.use()` answers what the trigger said (`UseStatus`: `ok`, `drawing`, `cooldown`, `empty`...), so a script knows when a pull did nothing. `tool.phase` turns null in the frame that ends the draw, which is the trigger's frame too: a pull before the next frame answers `drawing` and throws nothing. The explosion budget (`examples/test-room/perf.mjs`) pulled there now and then on software GL, where a frame outlasts its 300 ms wait, and failed with "no blast after frag_grenade"; it now pulls again on the next frames until the trigger takes it.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [cbb20a2]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [6247fbe]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
- Updated dependencies [65ccb0c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-player@0.5.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-terrain@0.2.1
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-destruction-three@0.13.0
  - @adatechnology/game-runtime@0.2.0
  - @adatechnology/game-graphics@0.1.0
  - @adatechnology/game-graphics-three@0.1.0
  - @adatechnology/game-vfx-three@0.5.0
  - @adatechnology/game-terrain-three@0.3.0
  - @adatechnology/game-fluids-three@0.4.8
  - @adatechnology/game-vfx@0.7.0
  - @adatechnology/game-fluids@0.4.2
  - @adatechnology/game-weapons@0.5.8

## 0.20.0

### Minor Changes

- e413341: The inspector says what the floor under the aim is: the ground profile (Dirt, Concrete slab), the material exposed there and how deep it was dug (`terrainProfileName`, `InspectInfo.ground`).
  A floor laid anew (opening an area, a reset) is drawn whole in the same frame instead of showing holes to the sky until every chunk had its turn (`Terrain.dirtyChunkCount`).

### Patch Changes

- Updated dependencies [e413341]
- Updated dependencies [e413341]
- Updated dependencies [379e44f]
  - @adatechnology/game-terrain@0.2.0
  - @adatechnology/game-terrain-three@0.2.0
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-vfx@0.6.0
  - @adatechnology/game-vfx-three@0.4.0
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-destruction@0.13.2
  - @adatechnology/game-destruction-three@0.12.1
  - @adatechnology/game-fluids@0.4.1
  - @adatechnology/game-fluids-three@0.4.7
  - @adatechnology/game-player@0.4.1
  - @adatechnology/game-weapons@0.5.7

## 0.19.1

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0

## 0.19.0

### Minor Changes

- 0c67a15: Cans open before they are eaten, and a holed or leaking can is no longer food.

  - `game-contracts`: `SealSpec` (what opens a closed container: `openWith` tools or `byHand`; `spoilsWhenBreached`), `sealOpener` and `sealBlock`, and `TestableItem.seal` (`ModuleItemSeal`, with `open` and `contents` to draw the item open and what is left in it). `ItemUseDef` keys take the `eat` action.
  - `game-items`: `ItemDef.seal`; `resolveUse` with `UseContext.seal` does not spend a sealed item that is still closed, holed through or leaking (`UseResult.blocked`).
  - `game-items-goods`: the `canned_food` kind opens with a can opener, a pocket knife or a knife; `canned_drink` and the sardines open by hand; both are spoiled by a hole or a leak. The kind's seal is on every item of the catalog.
  - `game-fluids`: the `eat` use (spoonfuls from an open tin); `drink(id, liters, { eaten })` takes the liquid packed with the food without the effects of drinking it.
  - `game-items-three`: `openItem` draws a model open (`data/opening.json`): the cut lid of a tin bent up with the food inside the rim, the peeled lid of the sardines, the mouth of a drink can; `setOpeningContents` empties it as it is eaten. The items area gives the tins `seal` and the `eat` use.
  - `game-test-room`: a use that empties a sealed item opens it first, by hand or with a tool of the seal within reach or in the loadout, and says what is missing; a holed or leaking item is refused for eating and drinking; eating logs what was eaten.

- f911ab1: How long debris stays on screen is configurable per fragment: `fragmentLife` takes a rule `(fragment, objectId) => seconds` besides a number (0 = forever), so rubble can stay and chips can go by material, size or object. The test room takes `debris: { fragmentLife, maxFragments, particles }`, where `particles` tunes the dust, smoke and chip sprites by kind.
- 7dc60fa: With a body that has `eye()`, crouching, bending over a low piece to push it and sitting no longer lower the player's own eye: the camera follows only the body's eye and the pose decides the rest (crouched about 1.3 m instead of 1.15 m). A room without a body keeps the old eye math. The shot leaves the body's eye in both views.
- aa75500: One body for both views. A `RoomAvatar` with `eye()` is drawn in first person too: the camera sits at the body's eyes (pulled back out of a wall), and the aim, shots and the hands' `reach` start from there in both views, so switching views moves no hand, foot or head. `setView` hides the head from the player's camera only. The separate first-person arms are gone from the room (`RoomAvatar.firstPerson` removed); `toRoomAvatar` makes them only when asked (`firstPerson`) and exposes `eye`/`setView`. A scripted `room.look` keeps its exact view until the player moves. A carried item rides the body's hand.
- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- a1ce099: Pushing is no longer offered for everything: only a piece whose definition says `pushable` (a sofa, a wardrobe, a fridge, a grill) is leaned on. What goes in the hand is grabbed at once.
- 4f6c534: `debris.eventBudgetMs` sets how many milliseconds of destruction events the room applies per frame (default 8); `Infinity` keeps a scenario's counts the same on any machine.
- 711af5d: Seats: a `TestableItem` (and `TestRoomItem`) can bring `seats` (`ItemSeat`, the shape of a `game-interactables` seat), and the room seats the player there with `room.sit(objectId?, seatId?)`: the eye over the hips, facing the front of the item, the walk held and the view kept near that facing. A walk key or a jump gets up at the seat's exit (`room.stand()` does it by script), and so does losing the item or a reset of the room; `room.seat` says where the player sits. The furniture area passes the seats of the household types (chairs, sofa, armchair, beds, benches).
- a2ce4c5: The body sits and lies too, not only the camera: `AvatarUpdate.seat` (`{ pose: 'sit' | 'lie', hip }`) folds the legs under hips at the seat height, the knee opening until the sole reaches the floor (a low seat sends the shins forward), with the hands on the thighs; `lie` lays the body face up with the pelvis there and the head behind. The test room passes the seat the player sits on (`RoomSeat.hips`) to the body, so sitting in first person shows in third person.
- 7ca2f8e: A screw cap is turned off by the other hand before the first bite or sip, in first and third person. `twistStroke` (game-contracts) is the hand turning a part round in strokes, for any cap, tap or knob; `ModuleItemSeal.openUse` and `turn` let a module open its seal with a use; the `unscrew` use (game-fluids) turns during its `turn` keys and opens at its `open` key; `turnItem` (game-items-three) turns and lifts the cap a model marks with `asLid`; the body takes the other hand's grip from `AvatarItemUsePose.gripL`.
- f8c2b21: Third person draws the weapon on the body at its real size: new optional `ModuleHost.holdFrame()` (the pocket of the right shoulder turned to the aim; null in first person), which the test room lends from the avatar's new `shoulder(side)`. The weapons viewmodel puts a long gun's stock in the pocket (a launcher slides back until its grip is in reach), a handgun or a one-hand tool at a ready grip, and caps the support hand's span at 0.5 m. Looking up or down no longer drives the arms into the body.

### Patch Changes

- b818f6a: A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

  A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.

- 9e0aa58: An item carried in first person no longer lifts the elbow above the shoulder: `HandTargets.elbows` (`view`, the default, or `body`) says where the elbows go, and the first-person arms keep the elbow in the view only for `view`; the room's carried items ask for `body`, so a tin in the hand has its forearm coming from below (elbow bend 103° instead of 57°). While C crouches, an item's second use (empty a tin) is on Shift+F instead of C, and the HUD says so. The items area lays an opening tool beside each sealed tin (a can opener next to the beans), within reach when the tin is picked up.
- 2d12449: With a body, the carried item rides the body's right hand in both views, including while it drinks, pours or opens, so in first person the body's arm brings it up. Without a body it still floats in front of the eye.
- 7f7dd06: A leaf left between closed and open goes the other way from where the last use sent it: a door that hit something while opening closes on the next E instead of trying to open again forever (`DoorUseTarget.lastGoal`, `DoorUseRules.endTolerance`; the room remembers the last way of each leaf). At either end the old rule holds, so a leaf put back by a reset opens.
- 5d5e869: `onLoosened` is also called when furniture came apart and the renderer made what stayed a piece, with a new `cause` argument (`blast` or `apart`). The test room stops keeping the footprint of a table knocked over that way, so no invisible wall stays where it stood.
- 5a2f8e7: A car door that opens is the door itself: the first swing cuts the door's own skin out of the body and hangs it on the hinge, with its trim and side window, in place of the flat plate (the lid takes its skin too). The room moves a part's collision shape round the hinge its drawn group turns on, not round the shape's own centre, so a car door no longer stops against its own body. `sweepBox` with `ignore` also ignores the parts of an object hosted by an impl (a vehicle).
- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

- 3642202: The weapon in the hands is the body's own, at its real size, in first and third person: no first-person scale-down and no offset in front of the camera. `holdFrame` (the pocket of the right shoulder) now answers in both views, and a host with no body gets the same pocket under the camera's eye. A gun with no stock slides forward so its grip is never behind the eye, a short two-hand gun is held at mid-chest, the grips of both hands stay above the bottom of the view (`HAND_IN_VIEW`, up to 0.3 m) and the weapon comes back from a wall (`WALL_PULL`, up to 1.2 m). The generic props ride the body too. The player's body no longer stops the weapon's contact and laser rays. The support arm's elbow tucks under the gun, so the forearm meets the handguard at 47 to 51 degrees off the aim.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [f911ab1]
- Updated dependencies [7f7dd06]
- Updated dependencies [385281b]
- Updated dependencies [5d5e869]
- Updated dependencies [7051d83]
- Updated dependencies [6ef4843]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [b58423f]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [32529a1]
- Updated dependencies [711af5d]
- Updated dependencies
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-fluids@0.4.0
  - @adatechnology/game-destruction-three@0.12.0
  - @adatechnology/game-destruction@0.13.0
  - @adatechnology/game-player@0.4.0
  - @adatechnology/game-terrain@0.1.2
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-fluids-three@0.4.6
  - @adatechnology/game-terrain-three@0.1.2
  - @adatechnology/game-vfx-three@0.3.6
  - @adatechnology/game-weapons@0.5.6

## 0.18.0

### Minor Changes

- f44dbbc: Third person: the body's hands go to the grip and the forend of the tool in hand. Shoulder, elbow and wrist bend inside the human range (the elbow never locks), the chest turns and the shoulder blade slides toward a far support hand. New `PlayerAvatar.reach(targets)` and optional `RoomAvatar.reach`, called by the room every frame in third person.

## 0.17.1

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0
  - @adatechnology/game-destruction-three@0.11.1
  - @adatechnology/game-vfx@0.5.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-fluids@0.3.6
  - @adatechnology/game-fluids-three@0.4.5
  - @adatechnology/game-player@0.3.1
  - @adatechnology/game-terrain@0.1.1
  - @adatechnology/game-terrain-three@0.1.1
  - @adatechnology/game-vfx-three@0.3.5
  - @adatechnology/game-weapons@0.5.5

## 0.17.0

### Minor Changes

- f68acce: Cans dent where they are hit and are holed on the lid, the bottom and the rim as on the side. An item family can give its shell the real wall thickness (`rule.wall`: a drink can is 0.1 mm on the body and 0.25 mm on the ends, a food tin a bit more); `tagForDestruction` writes it as `userData.destructionThickness` and `specFromObject3D` uses it for the part, so a 9 mm goes through a lid even at a slant. With `tessellate.cylinder.capRings` (and `three` passed to `tagForDestruction`, as `buildItem` does) each cylinder of the model becomes one lathe with rings on its ends and rows as fine as its columns, and a model drawn as a lathe gets the same columns, so the lid and the bottom have vertices to dent. In the world a ductile sheet 0.5 mm thin or less folds deeper than a plate for the same blow (up to 4 times), on a patch no wider than 2.5 cm and never past near its middle, and the slit a blade cuts in it is pushed in around. A skin follows its shell past the degenerate triangles of a lathe. The liquid of an opaque container is not drawn through a narrow mouth (a can's tab) nor through the bullet holes drawn on it.

  The test room pushes what a round hits at the point of the drawn surface it meets, along that surface's inward normal (plus a share along it), with the momentum the round lost there: all of it when it stopped, through a thin shell only what the wall and the liquid inside took. A round on the right of a can pushes it away and to the left and spins it; before, it got the whole momentum of the round along the shot at the box the world sees.

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.
- df6572b: The kick has a key of its own: K (option `kick.keys`) kicks with the arsenal's `kick` tool whatever is in hand, as Shift+V did, plus a Kick button and `room.kick()`. The kick now lands from the leg (`kickHeights`: shin, knee, hip) on what stands low in front instead of along the eye's ray, which went over a chair at the feet.
- 31fc87d: Each material answers each kind of blow its own way. New `MaterialDef.hits` (material × damage type): what a blow tears out where it lands (`tear`: `splinters`, `lumps`, `none`) and the joules per piece. A round into wood tears splinters of fresh wood out of the exit (and back out of the entry), MDF crumbles lumps, plywood splinters; a punch crumbles MDF, a kick splinters pine, hardwood and steel tear nothing. Snapping boards (MDF, plastic) also break where they are shot. `innerColor` for wood, plywood and MDF. Cases with shelves (`furnitureSpec`) are MDF.

  Loose pieces land on what is under them: on other pieces and on the drawn meshes of fixed objects (`PieceSystemOptions.staticTopAt`), so a falling shelf rests on the books below and a tipping panel on the chair in front. New `DestructionRenderer.solidsNear` gives the drawn boxes around a point. The test room's player walks by them: steps onto low debris (up to 45 cm), stops at taller things and kicks light pieces (books, boards) out of the way, instead of the scenery's old footprints.

- eaedd22: Physics of the objects in the room (first object audited: the trash bin). The player no longer walks through spawned objects: what stands taller than a step blocks the walk, and the walk pushes what is light enough with the force of a person against the floor's grip (a 3 kg bin slides or tips, a 70 kg fridge only blocks); the walk moves in short steps so a long step cannot jump over a thin obstacle. A kick leaves the hip instead of the eye, so it reaches what is in front of the feet. A round through a ductile shell (plastic, sheet metal) leaves in it only the energy it took to cross it (two holes, the part does not burst); a blade with more energy than a thin wall takes goes through it (a knife into a plastic bin or a can). A burst of fragments over the live budget no longer builds the excess meshes only to fade them.
- 8aa480b: A punch combo as an ability. `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` gain `jab`, `hook` and `uppercut` (written for the right hand, the left plays the mirror), and `PUNCH_COMBO` (`StrikeCombo`) chains jab (left), cross (right), hook (left), uppercut (right). The test room takes it as `strikeCombo`: while it is on (N, its button, `setStrikeCombo`, `strikeComboOn`) each punch is the next step and a pause longer than `reset` starts over; off, the punch is the usual one. The player body closes the hands for any clip whose impact is a punch.
- 3aec7f3: `ModuleHost.addObject` (game-contracts, implemented by game-test-room): a module puts an item of the host's catalogue in the world as scenery; it stays through clears and area openings, takes shots, blows, blasts and fire like any item, and the scenarios run without it. The weather visual's `rigItem` uses it: in the test room the headlights car is the fleet's real sedan (holes, glass, sparks, tyres, doors), no longer a drawing the shots went through.
- 31fc87d: A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

  `DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

  The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.

  Furniture that comes apart no longer leaves anything fixed: what stayed standing becomes a piece too, and a piece whose feet are too close for its height (a lone leg, a board on two legs in a line) falls over until it lies.

### Patch Changes

- ae81390: Crouching in the test room. A tap of C stays crouched until the next tap and a longer press crouches while held; before, a tap only dipped the view for a moment. A crouched body keeps its legs bent under a punch and the fighting guard, which used to stand it up while the camera stayed low; only a kick takes the legs.
- 7d7e9dc: A piece of the scenery that comes loose leaves its fixed footprint behind: the push no longer stops at it, and what is too wide for the renderer's boxes stops the player by its body wherever it goes. A player touching something by a hair no longer loses every collision: caught in something, the player walks out of it and never deeper.
- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
- Updated dependencies [31fc87d]
- Updated dependencies [1821647]
- Updated dependencies [6d15aad]
- Updated dependencies [ffe17e5]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-destruction-three@0.11.0
  - @adatechnology/game-fluids-three@0.4.4
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-terrain@0.1.0
  - @adatechnology/game-terrain-three@0.1.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-player@0.3.0
  - @adatechnology/game-vfx-three@0.3.4
  - @adatechnology/game-fluids@0.3.5
  - @adatechnology/game-vfx@0.4.4
  - @adatechnology/game-weapons@0.5.4

## 0.16.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- 454e821: Punches alternate hands and the third-person punch reads as one. The room throws `hand`/`fists` punches right, left, right (`punchHand`: `alternate` default, `left`, `right`; `punchTools`) and logs the hand; `strike(clip, { hand: 'left' })` plays the mirror of the clip on the body and the left fist on the first-person arms (`arms.play(clip, { hand: 'left' })`). On the body, `punch_right` and `front_kick` now move the same arm and leg the first-person view shows (they moved the other side), the punch aims at the centre with the guard up, and the joints follow a clip that does not loop 5 times faster (`clipCascade`), so the arm reaches the shoulder by the impact instead of lagging halfway.
- 5ec938d: Test table panel: the trial buttons (Shot, Punch, Knife, Fire, Blast, Put back) sit above the list of items on the table, so a long page no longer scrolls them out of sight.
- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0
  - @adatechnology/game-destruction-three@0.10.0
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-fluids@0.3.4
  - @adatechnology/game-fluids-three@0.4.3
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3
  - @adatechnology/game-weapons@0.5.3

## 0.15.0

### Minor Changes

- 7e0f629: Test table: `room.testTable` lays the catalogue on a `test_table` scenery piece a page at a time (with a search that finds the page of an item) and runs a trial on the item picked: a shot, a punch, a knife blow, a flamethrower burst or a fragmentation grenade set off beside it, plus a **Put back** that restores the table and the page. The room's panel gets a **Test table** card. `examples/test-room` uses the long dining table of the furniture catalogue (`?table=<group>` lays a group on start).

### Patch Changes

- fbd213a: Bare hands punch at the click again: the default tool (the hand) used to only grab on the left button, so the punch clip never played. Now the click punches (`strikeClips.hand`, on the arms and on the body), lets go of what is held, and E or the right button grab; `room.use()` does the same. A click pressed and let go between two frames is no longer lost.
- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0
  - @adatechnology/game-destruction-three@0.9.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-fluids@0.3.3
  - @adatechnology/game-fluids-three@0.4.2
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2
  - @adatechnology/game-weapons@0.5.2

## 0.14.0

### Minor Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.

### Patch Changes

- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-destruction-three@0.8.2
  - @adatechnology/game-destruction@0.8.2
  - @adatechnology/game-fluids@0.3.2
  - @adatechnology/game-fluids-three@0.4.1
  - @adatechnology/game-vfx@0.4.1
  - @adatechnology/game-weapons@0.5.1

## 0.13.0

### Minor Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-destruction-three@0.8.1
  - @adatechnology/game-destruction@0.8.1

## 0.12.0

### Minor Changes

- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- b3afeea: Breaking (0.x, so minor): the room no longer ships the procedural demo catalogue or its built-in scenarios. Removed: `demoItems`, `DEMO_ITEMS`, `DEMO_MATERIALS`, `SCENARIOS`, `scenariosFor`, `makeScenarios`, the demo item names of the locale tables and the `sc.*` texts of the removed scenarios. Pass `catalog: []` and load the SDK modules with `room.loadModule`; scenarios come from the host and the modules. `brickWallSpec` stays (the arena's target wall). See the README section "Breaking".
- 15c5da6: The kick alternates legs (`kickLeg`: `alternate` default, `left`, `right`). `mirrorPoseClip` mirrors a pose clip (legs and arms swap, sideways channels flip, events and times stay); the first-person arms play a kick with `play(clip, { leg: 'left' })`; the room logs the leg in the strike entry.
- 766acf0: The room can show the player's body and a third-person camera. `setAvatar(avatar | null)` takes any `RoomAvatar` (`root`, `update(dt, state)`, optional `hand(side)`), places it at the feet with the player's yaw and feeds it speed, running, armed (a firearm in hand) and pitch; `setAvatarState({ crouch, down })` lets a player module drive the rest. `setCameraMode('first' | 'third')` (V with a body; Shift+V kicks) puts the camera over the shoulder with the team game's numbers (3.8 m back, 0.9 m aside, 1.95 m up), pulled in against walls; the carried item follows `avatar.hand('R')`. The simulation and the aim stay at the eye. HUD, hint and log in `pt-BR` and `en`.
- 5806205: `RoomLoading.idle()` (`room.loading.idle()`): resolves once no loading task is open, so a scenario or a test waits for a rebuild that runs behind the loading indicator without sleeping.
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 72e195a: First-person arms and strikes at the impact: `RoomAvatar.firstPerson` and `RoomAvatar.strike`, options `strikeClips` and `handStances`. Fists, shove and the kick play their clip and land the blow at its impact second, with the aim read again; a `strike` line goes to the log.
- a185888: Strikes stop at contact: the update state of the first-person arms takes an optional `contact(origin, direction, maxDistance)` (distance to the first surface or null) that the room answers with its raycast, leaving out the player, the held item and the viewmodel. The hands and the kick foot stay a few millimetres in front of the surface along the camera forward, so the elbow bends instead of the hand entering the mesh.
- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

### Patch Changes

- 1b1d611: Per-caliber penetration table in `game-weapons` (`AMMO`, 50 loads, `arsenal.loadOf`, `weapon.setAmmoKind`, `ArsenalOptions.ammo`): per calibre and kind of round
  (fmj, hp, ap, buck, slug, birdshot, incendiary, tracer...) the core and jacket, the mass and speed when they differ, the energy and the millimetres of steel,
  concrete, brick and wood it goes through. The shot carries `ammo`, `penetration`, `incendiary` and `tracer`. `game-contracts`: `Hit.penetration`, `Hit.incendiary`,
  `Hit.tracer`, `Hit.ignition`, `shotExtras(shot, distance)` (the penetration scaled by the energy left) and `shotToHit` passes them. `game-destruction` reads
  `Hit.penetration` by material class (`MaterialDef.penetrationClass` / `penetrationScale`), keeps `Hit.piercing` as the energy-rule fallback and reads no calibre
  names: `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are removed (breaking). `shoot` takes `{ penetration, piercing, ... }` or a bare piercing factor.
  `game-test-room` passes the round of the shot to the world.
- 9b27571: `ModuleHost.player()` returns a generic `PlayerState` (`position`, `yaw`, `pitch`, `crouching`, `speed`, `running`, `cameraMode`), and `HostEvent` gains `{ type: 'player' }` for when crouching or the camera mode changes. A host implementing `ModuleHost` must add `player()`. The test room answers from its player controller (not crouching, first-person camera for now).
- f62305b: Reload sounds follow the animation: the reload clips carry `sound` cues (mag release/out/insert/seat, slide release, charging handle pull and release, bolt lift/pull/push/lock, a shell per round, pump, lever, cylinder, speed loader, barrels, belt cover, rocket, grenade, breech and tube) and the viewmodel plays each one at its second, scaled to the weapon's reload time. The recipes are data (`reload-sounds.json`), with a weight and material profile per weapon; `WeaponAudio.cue`, the `reloadCues` option and `createWeaponFx({ onSound })` are new. `ModuleHost.log` takes an optional entry `type` (the weapons area logs one `sound` entry per cue).
- 8ebb70b: `openArea` skips a placement whose item is not in the catalogue and logs it (`area_skip`) instead of failing.
- 1124b2d: The holder the room puts around an item whose builder scales the root answers for the root the module built (its visibility), and lets go of it when the item leaves the scene.
- dbe8de3: Add `useToHit(use, point, normal?)` next to `shotToHit`: the public `Use` -> `Hit` mapping (melee blunt/slash, flame -> fire, heat, throw -> explosive or the molotov fire patch; `null` for tool, extinguish and hand). The test room uses it instead of its private copy.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [3ebc4d5]
- Updated dependencies [31e7483]
- Updated dependencies [7b5efe4]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [642f290]
- Updated dependencies [5679830]
- Updated dependencies [8842f5b]
- Updated dependencies [e4663e1]
- Updated dependencies [0604035]
- Updated dependencies [1b1d611]
- Updated dependencies [9f7dadf]
- Updated dependencies [d610199]
- Updated dependencies [fa6ea00]
- Updated dependencies [8dc6775]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [d3581b5]
- Updated dependencies [bcf60c8]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
- Updated dependencies [011e17a]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-destruction-three@0.8.0
  - @adatechnology/game-vfx@0.4.0
  - @adatechnology/game-weapons@0.5.0
  - @adatechnology/game-fluids-three@0.4.0
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-audio@0.2.1
  - @adatechnology/game-fluids@0.3.1

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
