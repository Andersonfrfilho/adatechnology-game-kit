# @adatechnology/game-characters-three

## 0.11.5

### Patch Changes

- Updated dependencies [4e8b8b8]
  - @adatechnology/game-audio@0.12.0

## 0.11.4

### Patch Changes

- Updated dependencies [89f1d9d]
  - @adatechnology/game-audio@0.11.0

## 0.11.3

### Patch Changes

- Updated dependencies [baaa7d4]
  - @adatechnology/game-audio@0.10.0

## 0.11.2

### Patch Changes

- 6ed8da2: A look down in first person no longer shows the shirt as a blue ring around the camera: the upper body is cut, for the first-person camera only, at a plane 6 cm behind the eyes (what a real head hides from its own eyes: the tops of the shoulders, the collar, the back). The chest, the belly and the legs still show; shadows, mirrors and the third person keep the whole body.
- Updated dependencies [c4b8218]
- Updated dependencies [5ce9f7b]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-audio@0.9.4
  - @adatechnology/game-characters@0.2.16

## 0.11.1

### Patch Changes

- Updated dependencies [b1f747f]
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-characters@0.2.15
  - @adatechnology/game-audio@0.9.3

## 0.11.0

### Minor Changes

- 624ee79: A weapon in each hand, finished. The magazine change frees a hand as a person does: the other weapon is tucked in the belt (`rules.dualWield.stowSeconds`, 0.45 s), the free hand goes to the magazine well of the weapon being reloaded and back, the weapon is drawn again, then the same the other way round; neither weapon fires meanwhile. The contracts gain `HostTool.stowed`, the `stow` host event and `HandTargets.fingersL` (the left hand's index finger, as `fingers` is the right's); the first-person arms and the player's body curl each index finger by it (the body's right index now follows `fingers` too). Q (fire mode) and B (safety) act on the weapon of the hand that fired last, and X clears the stuck weapon (the last-fired one first).

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-characters@0.2.14
  - @adatechnology/game-audio@0.9.2

## 0.10.0

### Minor Changes

- 49b8d77: The first-person viewmodel, as shooters draw the weapon in the hands. `FIRST_PERSON_LAYER` and `ModuleHost.setViewmodelFov` (game-contracts) give a host a layer it draws over the world with the depth cleared and the lens of the tool. The test room draws it (its world camera leaves the layer out), takes first-person arms of its own (`firstPersonArms`: `createFirstPersonArms` of game-characters-three fits it) whose hands go to the tool's grips, and hides the body's arms from the eye (`setView(mode, camera, { arms: true })`). The weapons module puts the gun in the hands on the layer: held at the hip by kind (`VIEW_HOLD`: long gun, handgun, launcher, a tool in one hand carried point up), drawn through a lens per kind, brought to the eye by the right button (the sights on the line of the eye), with the sway behind the turn of the view and the bob of the step (`VIEW_MOTION`); the flash, the smoke, the casings and the tracer leave the muzzle as drawn (`toWorldLens`). The kick of a shot now comes back: 70 % of each kick returns within about a quarter of a second (`recoilReturn` of the room's player). Third person is unchanged: the body shoulders the gun.

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-characters@0.2.13
  - @adatechnology/game-audio@0.9.1

## 0.9.6

### Patch Changes

- Updated dependencies [9a44330]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-audio@0.9.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-characters@0.2.12

## 0.9.5

### Patch Changes

- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [61a4a79]
- Updated dependencies [63adb4c]
- Updated dependencies [78e76b0]
- Updated dependencies [33c09f1]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-audio@0.8.0
  - @adatechnology/game-characters@0.2.11

## 0.9.4

### Patch Changes

- Updated dependencies [2aae2ac]
  - @adatechnology/game-audio@0.7.0

## 0.9.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.9.2

### Patch Changes

- 8f07024: A blast pushes a body by its blast wave, not by a game coupling. `blast-impulse` reads the impulse of the wave (Kinney and Graham's side-on impulse, reflected on the body) from the charge in kg of TNT and the distance. `knockOf` takes the body's area and mass, so a hand grenade at 3 m moves a person a few tenths of a metre per second and a big charge close throws them. A body inside the lethal radius that the blast reaches falls where it stands, wounded, and lies longer. Cover that stops half the blast stops the fragments too. A body in reach is stunned, and the player's view sways while stunned.

  Each explosive of the arsenal gives its charge (`ExplosiveDef.tnt`: M67 0.24 kg, C4 0.76 kg, P13 1.5 kg, and so on). The charge travels on the detonation, the `explodes` spec, the destruction `explode` event and the host `explosion` event (`tnt`, `lethalRadius`). A blast without a charge takes one from its energy at the arsenal's scale. The horde keeps its own shove.

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-audio@0.6.1
  - @adatechnology/game-characters@0.2.10

## 0.9.1

### Patch Changes

- Updated dependencies [6b44b4e]
  - @adatechnology/game-audio@0.6.0

## 0.9.0

### Minor Changes

- The body falls the way the blast pushed it: on its back when it faced the blast, face down when the blast was behind it (`AvatarUpdate.fallForward`, `RoomAvatarState.fallForward`, `player.knockedForward`; `toRoomAvatar` passes it on). The first-person view lying face down looks at the ground; on the back, at the sky.

## 0.8.1

### Patch Changes

- a27d5ae: A blast's shove is blocked by cover and reaches the player. `DestructionWorld.blastReach(point, target)` gives the share of a blast that gets through what stands between, vehicles included as shells crossed through both walls (always on, whatever `BlastOptions.shelter` says); the renderer cuts the push of pieces and loose furniture by it, the host lends it to the modules (`ModuleHost.blastReach`), and the people of the characters module and the horde (`CrowdBlast.reach`, shove and damage, no lethal core behind solid cover) use it. The knock of a body (`knockOf`, `stepKnock`, `bodyMass`) moved to game-contracts, and the test room's player is shoved by it: thrown, off its feet when the push passes 2.5 m/s, lies a while and gets up (the view drops to the floor and rolls, the body takes its down pose; `TestRoom.playerKnock`, `TestRoomOptions.playerMass`). A body or a piece thrown into something firm stops there instead of passing through: the room's player slams into the wall (`PlayerOptions.onSlam`; the wall takes a blunt blow of `½ m v²`, body thud and hurt cry), and the pieces of the renderer sweep their way through the world (`PieceSystemOptions.sweep`/`onSlam`): a crate thrown at a wall stops, bounces a little, and both take the blow.
- 5ff4a45: The survivor and Bestiário builders are typed (no `@ts-nocheck`): `PersonSpec`, `PersonCharacter`, `BestSpec`, `BestPose` and the rigs are exported, `PersonBuilder.build` returns a `PersonCharacter` and `BestBuilder.build` a `THREE.Group`. A clothing entry without a colour now takes the top's material instead of none.
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
  - @adatechnology/game-characters@0.2.9

## 0.8.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- 15046ce: Body sounds by action and by floor. `game-contracts` names them (`footstep_<surface>_<walk|run>` on 12 surfaces, `land_<surface>_<light|heavy>`, the swing and the hit of each blow, hurt, bite, grab, body fall) with `surfaceOfMaterial` and the `footfall` host event; `game-audio` answers every id with `BODY_FOLEY_BANK` (four takes each) and adds sound sets (`SoundBank.sets`: a take that never repeats, at ±4% of rate, through `retunePlan`) and `SoundRequest.delay`; `game-player` emits the ids (`sound.ids`, the team class stays in `sound.sound`), reads the floor (`world.surfaceAt`, `input.surface`) and steps on the host's footfalls (`input.footfall`); the player body says when a heel is down (`footfall()`); the test room sends the footfalls, plays the jump and the landing on the floor under the feet, the swing just before the contact and the hit with it.
- f613255: The body batch is a plain `Mesh` over an `InstancedBufferGeometry` instead of an `InstancedMesh`: the unused `instanceMatrix` is gone, so the body program takes 11 vertex attribute slots instead of 15 and has room for the identity attributes. `BodyBatch.mesh` is a `BodyBatchMesh` (`Mesh & { count }`); `count` mirrors the geometry's `instanceCount`. The pose, the colours and the golden attributes do not change; the program key does (no `USE_INSTANCING`), so a warm-up must register the batch's own material after this change.
- 41b9dd4: The horde draw cost (spec 005, D12). `createCrowdRenderer({ variety })` gets a level `budget` (bodies per mesh level, bodies on the ground included; a crowd packed near the camera pulls the level edges in, the nearest bodies draw first), an `adapt` loop that sizes it from the crowd's GPU time (`EXT_disjoint_timer_query_webgl2`, the frame time where there is none), `nearDepthPrepass` (the near level draws its depth first so the room's lights shade a pixel once) and `detailScale`/`gpuMs` read-outs. `createBodyBatch` and `createVariantBatches` take `depthPrepass` and return `batch.prepass`; add it to the scene next to `batch.mesh`. `game-render-three` gets `createFramePacer`, which holds the draw back while the GPU is a frame behind.
- 33f4fd8: Identity for the instanced body (option `identity`, default off): the `iD` attribute and `BODY_CHUNK_EXT` (after the game's chunk, which stays byte for byte) give each body a gait style (limp, drag, lurch, shamble), a stagger pose (index 8), the lean of a shove, a 16-colour trousers palette and wound splashes by region with freshness. `createBodyMaterial` takes `identity`, `accessory` and `distance` (a `customDistanceMaterial` for point-light shadows) and sets `customProgramCacheKey` only with them. Accessories (`KIT_ACCESSORIES`: cap, helmet, backpack, hood) are baked once from the kit's survivor builder in a unit frame and placed per variant by `iAcc` (`accessoryPlacement`). `packIdentity` and `unpackIdentity` hold the layout.

  Fix: `accessoryPlacement` reads the head (bone 1, eyes left out) and the torso (bone 0) of a baked body, which marks skin, hair and trousers as one own-colour material; it used to look for skin and found nothing, so every accessory sat unscaled at the feet. A body without a head or a torso gets a zero scale: the accessory is not drawn.

- dc95951: The impostor tier of the economy ladder (with `variety`, `impostor: false` turns it off): `bakeImpostorAtlas` draws each silhouette (one per crowd type, from the far mesh of its first variant) on the CPU at 8 views and 8 steps of the walk into an RGBA8 atlas of bone, material class, shade and coverage (plus a colour layer), both `NearestFilter`; `createImpostorBatch` draws every far body in one call, picking its cell by the view angle and the walk phase, tinted per instance (shirt, trousers palette, missing limbs hide their bones). `createBlobShadowBatch` is the blob shadow under bodies beyond the nearest level. The renderer sends the bodies that walk past 90 m to the impostor batch and keeps the others on the far mesh. The identity extension recolours the legs above the shoes with the trousers palette, as the atlas does.
- 5aba035: Segment clips in a texture (step 3 of the ladder, option `variety.segmentClips`, default off): `bakeSegmentClips` samples 14 clips at 30 Hz (a walk, a limp on each side, a drag, a lurch, a shamble and a stagger, each with the arms down and raised) from the maths of the shader's walk into 12 bones of 24 texels, `createSegmentClipUniforms` makes the RGBA32F `NearestFilter` texture, and a body material built with `segmentClips` walks the bodies flagged `clips` in `iD` from it: the clips of the agent's gait family blended by how far it has raised its arms, the amplitude scaled by its gait, the phase and the cadence its own. Shadow and distance materials read the same texture. The other poses stay on the shader's procedural pose.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

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
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
- Updated dependencies [455522d]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-audio@0.4.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-characters@0.2.8
  - @adatechnology/game-render-three@0.1.0

## 0.7.2

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-audio@0.3.6
  - @adatechnology/game-characters@0.2.7

## 0.7.1

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0

## 0.7.0

### Minor Changes

- 9c4ec9f: `createPlayerAvatar` gains `eye(out?)`, the world position of the body's eyes (a socket under the head moved by the new `eyeOffset` option, default `[0, -0.068, 0]`, read at the end of `update()` before any `reach()`), the `eyeBob` option (how much of the walking bob reaches the eye, default 0.5) and `setView('first' | 'third', camera)`, which stops drawing the head and neck for that camera only. The rich rig now exposes `neck`.
- 28280ef: `PlayerAvatar.reach(targets, view?)` takes a `ReachView` (`{ camera, reachBend?, keepOutside? }`) for the body seen from its own eyes: `reachBend` (default `[1.35, 0.95]` rad, right then left) keeps the elbow bent where a hand is out of reach, the chest turn and shoulder-blade slide stopping where it still holds that bend, and `keepOutside` (`contact`, `margin` 0.005 m, `nearest` 0.12 m) pulls a hand back along the camera's forward to stay in front of a surface. Without `view` nothing changes.
- 9e0aa58: An item carried in first person no longer lifts the elbow above the shoulder: `HandTargets.elbows` (`view`, the default, or `body`) says where the elbows go, and the first-person arms keep the elbow in the view only for `view`; the room's carried items ask for `body`, so a tin in the hand has its forearm coming from below (elbow bend 103° instead of 57°). While C crouches, an item's second use (empty a tin) is on Shift+F instead of C, and the HUD says so. The items area lays an opening tool beside each sealed tin (a can opener next to the beans), within reach when the tin is picked up.
- 61bdbe1: First-person arms keep a visible elbow bend on a long gun: when a hand is out of reach the shoulder comes forward only until the elbow is bent by the new `FirstPersonRig.reachBend` (right 1.35 rad, left 0.95 rad by default), instead of until the arm is almost straight; `reachShift` goes from 0.35 to 0.42 m so the forend of a rifle stays in the support hand.
- fe1f40a: First person shows the elbows: holding a tool, each elbow is put a forearm from the wrist along the new `FirstPersonRig.elbowView` and kept inside the view (the trigger elbow out to the side; the support arm still rises from below the handguard), the shoulder behind it out of view. The first-person hand is now the Retratos do Vale hand the body wears (rounded palm, fingers of two joints, thumb) instead of boxes.
- aa75500: One body for both views. A `RoomAvatar` with `eye()` is drawn in first person too: the camera sits at the body's eyes (pulled back out of a wall), and the aim, shots and the hands' `reach` start from there in both views, so switching views moves no hand, foot or head. `setView` hides the head from the player's camera only. The separate first-person arms are gone from the room (`RoomAvatar.firstPerson` removed); `toRoomAvatar` makes them only when asked (`firstPerson`) and exposes `eye`/`setView`. A scripted `room.look` keeps its exact view until the player moves. A carried item rides the body's hand.
- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- a2ce4c5: The body sits and lies too, not only the camera: `AvatarUpdate.seat` (`{ pose: 'sit' | 'lie', hip }`) folds the legs under hips at the seat height, the knee opening until the sole reaches the floor (a low seat sends the shins forward), with the hands on the thighs; `lie` lays the body face up with the pelvis there and the head behind. The test room passes the seat the player sits on (`RoomSeat.hips`) to the body, so sitting in first person shows in third person.
- 7ca2f8e: A screw cap is turned off by the other hand before the first bite or sip, in first and third person. `twistStroke` (game-contracts) is the hand turning a part round in strokes, for any cap, tap or knob; `ModuleItemSeal.openUse` and `turn` let a module open its seal with a use; the `unscrew` use (game-fluids) turns during its `turn` keys and opens at its `open` key; `turnItem` (game-items-three) turns and lifts the cap a model marks with `asLid`; the body takes the other hand's grip from `AvatarItemUsePose.gripL`.
- f8c2b21: Third person draws the weapon on the body at its real size: new optional `ModuleHost.holdFrame()` (the pocket of the right shoulder turned to the aim; null in first person), which the test room lends from the avatar's new `shoulder(side)`. The weapons viewmodel puts a long gun's stock in the pocket (a launcher slides back until its grip is in reach), a handgun or a one-hand tool at a ready grip, and caps the support hand's span at 0.5 m. Looking up or down no longer drives the arms into the body.

### Patch Changes

- 7dc60fa: With a body that has `eye()`, crouching, bending over a low piece to push it and sitting no longer lower the player's own eye: the camera follows only the body's eye and the pose decides the rest (crouched about 1.3 m instead of 1.15 m). A room without a body keeps the old eye math. The shot leaves the body's eye in both views.
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
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [53babb5]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-characters@0.2.6

## 0.6.0

### Minor Changes

- f44dbbc: Third person: the body's hands go to the grip and the forend of the tool in hand. Shoulder, elbow and wrist bend inside the human range (the elbow never locks), the chest turns and the shoulder blade slides toward a far support hand. New `PlayerAvatar.reach(targets)` and optional `RoomAvatar.reach`, called by the room every frame in third person.

## 0.5.1

### Patch Changes

- Updated dependencies [73f3cf2]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-characters@0.2.5
  - @adatechnology/game-characters-people@0.4.1

## 0.5.0

### Minor Changes

- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.
- a2b0bb3: Third-person punches redone from boxing technique: jab, cross, hook and uppercut move the whole body (guard, hip and shoulder turn, full extension, front knee) from and back to a new looping `fight_guard` clip; `toRoomAvatar` holds that guard between punches (`guardClip`, `guardHold`, `punchBlend`), and a `grip` event closes the fists on a clip with no impact.

### Patch Changes

- ae81390: Crouching in the test room. A tap of C stays crouched until the next tap and a longer press crouches while held; before, a tap only dipped the view for a moment. A crouched body keeps its legs bent under a punch and the fighting guard, which used to stand it up while the camera stayed low; only a kick takes the legs.
- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 8aa480b: A punch combo as an ability. `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` gain `jab`, `hook` and `uppercut` (written for the right hand, the left plays the mirror), and `PUNCH_COMBO` (`StrikeCombo`) chains jab (left), cross (right), hook (left), uppercut (right). The test room takes it as `strikeCombo`: while it is on (N, its button, `setStrikeCombo`, `strikeComboOn`) each punch is the next step and a pause longer than `reset` starts over; off, the punch is the usual one. The player body closes the hands for any clip whose impact is a punch.
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [a2b0bb3]
- Updated dependencies [8aa480b]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-characters-people@0.4.0
  - @adatechnology/game-characters@0.2.4

## 0.4.2

### Patch Changes

- 454e821: Punches alternate hands and the third-person punch reads as one. The room throws `hand`/`fists` punches right, left, right (`punchHand`: `alternate` default, `left`, `right`; `punchTools`) and logs the hand; `strike(clip, { hand: 'left' })` plays the mirror of the clip on the body and the left fist on the first-person arms (`arms.play(clip, { hand: 'left' })`). On the body, `punch_right` and `front_kick` now move the same arm and leg the first-person view shows (they moved the other side), the punch aims at the centre with the guard up, and the joints follow a clip that does not loop 5 times faster (`clipCascade`), so the arm reaches the shoulder by the impact instead of lagging halfway.
- Updated dependencies [da5261d]
- Updated dependencies [454e821]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-characters-people@0.3.3
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-characters@0.2.3

## 0.4.1

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-characters@0.2.2
  - @adatechnology/game-characters-people@0.3.2

## 0.4.0

### Minor Changes

- df42f4b: The test areas use the pieces of the kit instead of boxes: the weapons counters are the buffet of the furniture catalogue, the shelves and the finds table of the items area are a workbench and a meeting table of the catalogue, the 1.80 m reference is a person the host gives (`person` of `createItemsTestModule`; `personSpecOf` of `game-characters-three` is exported for it), and the probe of the sound bench is what the host gives (`probe` of `createAudioTestModule`, a portable radio of the goods catalogue in the kit's room). Without `person` or `probe` the area draws none.

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-characters@0.2.1
  - @adatechnology/game-characters-people@0.3.1

## 0.3.1

### Patch Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.
  - @adatechnology/game-characters@0.2.0

## 0.3.0

### Minor Changes

- 6546677: The avatar area drops the four disabled "pending" entries (Soco, Empurrão, Chute, Tiro) and offers a button per registered clip, so passing `ATTACK_CLIPS` as `clips` gives the strikes. New option `clipLocales` for the phase texts, and a clip's `impact` event is logged as its own `impact` JSON line. `AvatarAreaText` loses `pending` and `pendingHint`.
- 4e90488: The player's body in the test room: `toRoomAvatar(avatar)` fits `createPlayerAvatar` to the room's `setAvatar`, and `createAvatarTestModule` (`AVATAR_AREA_ID` `avatar_area`) brings the bench buttons for the 1st/3rd person view, crouch, fall, armed and the pose clips (grab, bite), disabled entries for the animations pending from the Elenco team, metrics and a JSON line in the log per action.
- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- 574f847: `createFirstPersonArms` (sleeves, hands that close on a grip, a two-bone IK to the hand targets, stances, clips for punch, shove and kick with the right leg) and `toRoomAvatar` gives the room the arms and `strike` by default (`firstPerson: false` to disable). `PlayerAvatar` exposes `colors` and `three`.
- 6889db1: The hands work the parts a reload clip moves (`data/hand-work.json`: slide rack or thumb release on a pistol, charging handle on ARs and AKs after an empty reload, bolt handle, loading port, crane, belt cover), following the clip's own timeline; `ToolClipPlayer.running` exposes the clip time. The right index finger rests along the frame, goes to the trigger after a shot and pulls with the trigger part (`HandTargets.fingers.index`).
- 15c5da6: The kick alternates legs (`kickLeg`: `alternate` default, `left`, `right`). `mirrorPoseClip` mirrors a pose clip (legs and arms swap, sideways channels flip, events and times stay); the first-person arms play a kick with `play(clip, { leg: 'left' })`; the room logs the leg in the strike entry.
- 4ecaa9f: Keyframed pose clips and the player's body. `game-characters`: `PoseClip`, `samplePoseClip` (the Bestiário `sample`), `clipEventsBetween`, `createPoseClipRegistry` and the two
  "grab and bite" clips (`POSE_CLIPS`, texts in `pt-BR` and `en`). `game-characters-three`: `createPlayerAvatar`, the team game's player body (rich human, default spec as data) that
  walks with the gait tied to ground speed, crouches, goes down, plays pose clips over the gait (upper or full body, with blend and events) and has a hand socket for weapons.
- a185888: Strikes stop at contact: the update state of the first-person arms takes an optional `contact(origin, direction, maxDistance)` (distance to the first surface or null) that the room answers with its raycast, leaving out the player, the held item and the viewmodel. The hands and the kick foot stay a few millimetres in front of the surface along the camera forward, so the elbow bends instead of the hand entering the mesh.

### Patch Changes

- fcd0be6: The weapon models, the animals and the characters draw their geometry with game-shapes (`shapeGeometries(host)`), with the same bytes as before (exact goldens of 367, 27 and 281 cases). game-weapons-three no longer depends on game-props3d. The IIFE builds of game-props3d, game-interactables-three and game-weapons-three bundle game-shapes. `shapeGeometries` of a namespace it made gives it back.
- Updated dependencies [6546677]
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [95691ff]
- Updated dependencies [95691ff]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [15c5da6]
- Updated dependencies [1b1d611]
- Updated dependencies [d610199]
- Updated dependencies [9b27571]
- Updated dependencies [4ecaa9f]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-characters-people@0.3.0
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-characters@0.2.0
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-audio@0.2.1

## 0.2.1

### Patch Changes

- Updated dependencies [b6e8131]
  - @adatechnology/game-characters@0.1.6

## 0.2.0

### Minor Changes

- cca7380: The `body` events reach the running film of the liquids (T5.3e). `createFluidsBridge` takes a `film` sink (the `splat` of `createFilmBridge`): a `wound` throws 3 drops of blood, a `severed`, `destroyed` or `split` segment throws 4, 7 or 10 (options `spray`, `burstDrops`), thrown along the way out, in the colours of the body's `BloodLook` (`WoundBody.blood`). `bloodLookOfAge(age)` reads `ages.json` (fresh and dry colours, `blood` as the amount; ages thinner than 0.3 bleed `old_blood`), and the characters area takes `film` and `bloodOf(age)`. The test room exposes the film bridge as `room.film`.
- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).

### Patch Changes

- Updated dependencies [a41fcb7]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-characters@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-characters@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-characters@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [7fd46fb]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-characters@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-characters@0.1.1

## 0.1.0

### Minor Changes

- ac61bb5: Novo pacote `@adatechnology/game-characters-three` (fase 4): caminho instanciado do corpo da multidão — geometria `buildInstancedBody` (16/10/5), trecho de shader `BODY_CHUNK` igual ao do jogo, material, `createBodyBatch`, `bakeBody`/`bakeVariants` (regra ZVAR) e `createFlyingLimbs`. O three entra pelo host.
- 50eee43: Caminho rico do `game-characters-three` (spec 001, T4.1h, T4.1i e T4.4a): `createBestBuilder` (Bestiário v17, porte literal conferido por 780 cenas gravadas), `createPersonBuilder` (sobreviventes com 62 acessórios, chapéus, rosto e mãos), `createRigAnimator` (andar, cascata, pose), `createWounds` (corte, osso quebrado que balança, membro que voa, estouro, decalques), `findEyes`, `createFluidsBridge` e o módulo de teste `createCharactersTestModule` com `registerBodyMaterial` (`?area=characters`).

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [d8177f4]
- Updated dependencies [038d6f1]
- Updated dependencies [5e64ab9]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-characters@0.1.0
