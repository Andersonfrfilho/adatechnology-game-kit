# @adatechnology/game-contracts

## 0.20.0

### Minor Changes

- 0c67a15: Cans open before they are eaten, and a holed or leaking can is no longer food.

  - `game-contracts`: `SealSpec` (what opens a closed container: `openWith` tools or `byHand`; `spoilsWhenBreached`), `sealOpener` and `sealBlock`, and `TestableItem.seal` (`ModuleItemSeal`, with `open` and `contents` to draw the item open and what is left in it). `ItemUseDef` keys take the `eat` action.
  - `game-items`: `ItemDef.seal`; `resolveUse` with `UseContext.seal` does not spend a sealed item that is still closed, holed through or leaking (`UseResult.blocked`).
  - `game-items-goods`: the `canned_food` kind opens with a can opener, a pocket knife or a knife; `canned_drink` and the sardines open by hand; both are spoiled by a hole or a leak. The kind's seal is on every item of the catalog.
  - `game-fluids`: the `eat` use (spoonfuls from an open tin); `drink(id, liters, { eaten })` takes the liquid packed with the food without the effects of drinking it.
  - `game-items-three`: `openItem` draws a model open (`data/opening.json`): the cut lid of a tin bent up with the food inside the rim, the peeled lid of the sardines, the mouth of a drink can; `setOpeningContents` empties it as it is eaten. The items area gives the tins `seal` and the `eat` use.
  - `game-test-room`: a use that empties a sealed item opens it first, by hand or with a tool of the seal within reach or in the loadout, and says what is missing; a holed or leaking item is refused for eating and drinking; eating logs what was eaten.

- b818f6a: A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

  A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.

- 9e0aa58: An item carried in first person no longer lifts the elbow above the shoulder: `HandTargets.elbows` (`view`, the default, or `body`) says where the elbows go, and the first-person arms keep the elbow in the view only for `view`; the room's carried items ask for `body`, so a tin in the hand has its forearm coming from below (elbow bend 103° instead of 57°). While C crouches, an item's second use (empty a tin) is on Shift+F instead of C, and the HUD says so. The items area lays an opening tool beside each sealed tin (a can opener next to the beans), within reach when the tin is picked up.
- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- a1ce099: Pushing is no longer offered for everything: only a piece whose definition says `pushable` (a sofa, a wardrobe, a fridge, a grill) is leaned on. What goes in the hand is grabbed at once.
- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

- 711af5d: Seats: a `TestableItem` (and `TestRoomItem`) can bring `seats` (`ItemSeat`, the shape of a `game-interactables` seat), and the room seats the player there with `room.sit(objectId?, seatId?)`: the eye over the hips, facing the front of the item, the walk held and the view kept near that facing. A walk key or a jump gets up at the seat's exit (`room.stand()` does it by script), and so does losing the item or a reset of the room; `room.seat` says where the player sits. The furniture area passes the seats of the household types (chairs, sofa, armchair, beds, benches).
- 9c63053: A shot into MDF or wood left no hole: the lumps it tore off came as a `chip`, and the renderer cleared every mark inside it as if a brick had left the wall. The `chip` of what a blow tore off a face now carries `torn: true`, and the renderer and the house breach keep the hole and its marks.
- 7ca2f8e: A screw cap is turned off by the other hand before the first bite or sip, in first and third person. `twistStroke` (game-contracts) is the hand turning a part round in strokes, for any cap, tap or knob; `ModuleItemSeal.openUse` and `turn` let a module open its seal with a use; the `unscrew` use (game-fluids) turns during its `turn` keys and opens at its `open` key; `turnItem` (game-items-three) turns and lifts the cap a model marks with `asLid`; the body takes the other hand's grip from `AvatarItemUsePose.gripL`.
- f8c2b21: Third person draws the weapon on the body at its real size: new optional `ModuleHost.holdFrame()` (the pocket of the right shoulder turned to the aim; null in first person), which the test room lends from the avatar's new `shoulder(side)`. The weapons viewmodel puts a long gun's stock in the pocket (a launcher slides back until its grip is in reach), a handgun or a one-hand tool at a ready grip, and caps the support hand's span at 0.5 m. Looking up or down no longer drives the arms into the body.

### Patch Changes

- 3642202: The weapon in the hands is the body's own, at its real size, in first and third person: no first-person scale-down and no offset in front of the camera. `holdFrame` (the pocket of the right shoulder) now answers in both views, and a host with no body gets the same pocket under the camera's eye. A gun with no stock slides forward so its grip is never behind the eye, a short two-hand gun is held at mid-chest, the grips of both hands stay above the bottom of the view (`HAND_IN_VIEW`, up to 0.3 m) and the weapon comes back from a wall (`WALL_PULL`, up to 1.2 m). The generic props ride the body too. The player's body no longer stops the weapon's contact and laser rays. The support arm's elbow tucks under the gun, so the forearm meets the handguard at 47 to 51 degrees off the aim.

## 0.19.0

### Minor Changes

- 73f3cf2: Crushed masonry takes the colour of its material: brick, concrete, plaster and stone get `visual.innerColor`, the `debris` event names the material of
  the bits when it is not the part's own (`material`, the plaster coat over a brick wall), and the renderer throws chips and dust and draws spalls in that
  colour (brick orange, plaster light, concrete grey) instead of the dark grey of the generic concrete impact.

## 0.18.0

### Minor Changes

- 2c9c963: Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.
- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- 3aec7f3: `ModuleHost.addObject` (game-contracts, implemented by game-test-room): a module puts an item of the host's catalogue in the world as scenery; it stays through clears and area openings, takes shots, blows, blasts and fire like any item, and the scenarios run without it. The weather visual's `rigItem` uses it: in the test room the headlights car is the fleet's real sedan (holes, glass, sparks, tyres, doors), no longer a drawing the shots went through.

## 0.17.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 50d8074: `footprintBlocker` (game-contracts): the `ModuleHost.addBlocker` function of a solid object on the floor, a rectangle in the object's own space that turns and moves with it. The weather visual's lamp rig car now blocks the walking player with it (it stands in every area of the test room, and the player walked through it), and the vehicles test area uses it for its vehicles and the lane car.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

## 0.16.0

### Minor Changes

- bf68a04: A shot book tears into loose pages instead of slabs as thick as the book. New `MaterialDef.sheet` (thickness of one sheet; paper 1 mm): a `tear` part thicker than a few sheets comes apart as layers of thin scraps, a little askew, three in four marked `Fragment.inner` (pages) and the rest cover. New `visual.innerColor` (paper: cream) colours the inner scraps and the fibres a hit throws out. The renderer lets those thin scraps glide and flutter down before they settle flat.

## 0.15.0

### Minor Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.

## 0.14.0

### Minor Changes

- 1331018: An explosive part can carry `explodes.lethalRadius` (and a blast `Hit` its `lethalRadius`; the `explode` event repeats it). A character inside it takes the whole blast, between it and `radius` it takes at most `blast.injuryPoints` (default 15 per segment) falling off to nothing at `radius`, so it is hurt but not killed. Without `lethalRadius` the blast is the old one: points fall off over `radius`.
- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- ef44e99: Add the category engine: `defineCategories` (inheritance of any depth, `defaults`, `requires`, `abstract`; games add, patch, insert parents and remove through `extra`, `patches` and `remove`), `resolveEntry` and `checkCategorized` with `ContractChecker` and an `allow` list for known gaps.
- 5b1d53f: `DestructionWorld.vent(objectId, partId, { point?, normal?, diameter? })` opens a through opening in a container part like a valve does (a `leak` event, the level drops, no damage and no `hole` event; `Hole.vent` marks it) and `seal` closes it. A `heat` hit of 470 °C or more on a part that leaks flammable fluid lights the leak (a lighter or a torch held at a gas jet): it burns, or goes off by its `explodes.chain`. The renderer ends a leak when its opening is closed.
- b861fca: The hands contract: `HandPose` (world position and quaternion of a palm, one hand-local axis convention for both hands), `HandTargets` (`R`, `L`, `grip`, `gripL`, `scale`) and `HandTargetSource`, and the optional `ModuleHost.setHandTargets(source)` through which a module lends the host the place of the hands for the tool it holds. Generic: nothing in it knows a weapon.
- 6889db1: The hands work the parts a reload clip moves (`data/hand-work.json`: slide rack or thumb release on a pistol, charging handle on ARs and AKs after an empty reload, bolt handle, loading port, crane, belt cover), following the clip's own timeline; `ToolClipPlayer.running` exposes the clip time. The right index finger rests along the frame, goes to the trigger after a shot and pulls with the trigger part (`HandTargets.fingers.index`).
- 1b1d611: Per-caliber penetration table in `game-weapons` (`AMMO`, 50 loads, `arsenal.loadOf`, `weapon.setAmmoKind`, `ArsenalOptions.ammo`): per calibre and kind of round
  (fmj, hp, ap, buck, slug, birdshot, incendiary, tracer...) the core and jacket, the mass and speed when they differ, the energy and the millimetres of steel,
  concrete, brick and wood it goes through. The shot carries `ammo`, `penetration`, `incendiary` and `tracer`. `game-contracts`: `Hit.penetration`, `Hit.incendiary`,
  `Hit.tracer`, `Hit.ignition`, `shotExtras(shot, distance)` (the penetration scaled by the energy left) and `shotToHit` passes them. `game-destruction` reads
  `Hit.penetration` by material class (`MaterialDef.penetrationClass` / `penetrationScale`), keeps `Hit.piercing` as the energy-rule fallback and reads no calibre
  names: `PIERCING_BY_KIND`, `PIERCING_BY_CALIBER` and `piercingOf` are removed (breaking). `shoot` takes `{ penetration, piercing, ... }` or a bare piercing factor.
  `game-test-room` passes the round of the shot to the world.
- d610199: A normal bullet that goes through a fuel tank, a jerrycan or a gas bottle now only leaks; it no longer blows the tank up by itself. The leak lights with a spark of a
  hard round on steel, an incendiary or tracer round, a fire near (a burning part or fuel stain) or a blast, and then the usual fire and explosion run.
  `game-contracts`: `IgnitionRules`, `DEFAULT_IGNITION_RULES`, `resolveIgnitionRules`, `ignitionChance`, `fillFactor`, `sparkTargetFactor` (the container side: a fill curve where a full
  tank mostly leaks and a nearly empty one lights easiest, what a spark needs to strike, the fire near). `game-weapons`: `rules.ignition` (chance of the core and the jacket of the round,
  built from the ammo table, plus the flame of incendiary and tracer) and `ammoIgnition`; the shot carries `ignition`. `game-destruction`: `DestructionOptions.ignition`, the roll in the
  ballistic hit of a container of `gas` or `fuel`, fire near and blast. `game-vehicles`: `VehicleDestructibleOptions.fuel` (starting level) and `ignition`; the `E > 1500` rule that
  heated the tank is gone. `game-vfx`: `vehicle_leak` is now the leak without the fire and the blast, and `vehicle_leak_ignited` is the whole Garagem sequence. `game-vehicles-three`:
  `defaultEffectIds.leakIgnited`, asked when the tank catches fire.
- 9b27571: `ModuleHost.player()` returns a generic `PlayerState` (`position`, `yaw`, `pitch`, `crouching`, `speed`, `running`, `cameraMode`), and `HostEvent` gains `{ type: 'player' }` for when crouching or the camera mode changes. A host implementing `ModuleHost` must add `player()`. The test room answers from its player controller (not crouching, first-person camera for now).
- f62305b: Reload sounds follow the animation: the reload clips carry `sound` cues (mag release/out/insert/seat, slide release, charging handle pull and release, bolt lift/pull/push/lock, a shell per round, pump, lever, cylinder, speed loader, barrels, belt cover, rocket, grenade, breech and tube) and the viewmodel plays each one at its second, scaled to the weapon's reload time. The recipes are data (`reload-sounds.json`), with a weight and material profile per weapon; `WeaponAudio.cue`, the `reloadCues` option and `createWeaponFx({ onSound })` are new. `ModuleHost.log` takes an optional entry `type` (the weapons area logs one `sound` entry per cue).
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 024d0e8: Real structure (T10, steps 1 and 2). `game-contracts`: `PartSpec.structure.rebar` (`TensionRebar`: `ratio`, `yieldMPa`, `cover`), `PartState.flexure`
  and `PartState.cracked`. `game-destruction`: concrete (C25) and ceramic brick get `MaterialDef.strength` and capacities from the real strengths
  (NBR 6118, NBR 16868-1 slenderness, reinforced columns `0.85 fck Ac + As fy`), so an overloaded bearing wall crushes at the ground floor first;
  beams and slabs with `structure.rebar` bend (`structure.flexure`, scope `'rebar'` by default): the tension face cracks under a blast and the steel
  holds, a plain beam snaps, yielded steel past 10° hinges and the part falls in one piece; `sizeRebar`, `bearingWallThickness`, `buildFrame({ rebar })`;
  `rebar` joints of reinforced parts no longer wear under blows. Documented capacities change (a 30 x 30 cm concrete column now 203 t, a 20 cm brick
  wall 41 t per metre). `game-floorplan-structure`: `toDestructibleSpec({ rebar })` (off by default) declares and sizes the steel of concrete beams
  and slabs (`REBAR_RATIOS`).
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
- dbe8de3: Add `useToHit(use, point, normal?)` next to `shotToHit`: the public `Use` -> `Hit` mapping (melee blunt/slash, flame -> fire, heat, throw -> explosive or the molotov fire patch; `null` for tool, extinguish and hand). The test room uses it instead of its private copy.
- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

## 0.13.0

### Minor Changes

- f49e466: The effects of the weapon in the hands move onto `game-vfx`, drawn as the Arsenal gallery draws them. `game-vfx` gets a solid-particle primitive (`MeshSpawn`, `MeshPool`, the `mesh` step: cone, open cone, sphere, icosahedron with their segments, additive or lit material, a place and a turn inside a group, a scale ramp, growth, drag, gravity, spin, fading opacity), the whole turn of a thing (`PlayOptions.orientation`, `Placement.orientation`: pitch and roll included), named numbers (`PlayOptions.values`, read with `variable(name)`), the expression `exp`, a flash light that holds its strength (`flash(..., steady)`), and four recipes in the weapon's own axes with the gallery's numbers and order of draws (`VIEWMODEL_EFFECTS`): `viewmodel_muzzle_flash` (an open cone, four small cones and a core for 55 ms growing from 0.6 by 0.9, a light of 4 k over 2 k metres, six spheres of smoke), `weapon_smoke_puff`, `launcher_backblast` (26 spheres and 14 icosahedra) and `flame_jet` (`floor(420 dt scale)` icosahedra a frame and, half the frames, a sphere of smoke). `game-contracts`: `EffectRequest.orientation` and `EffectRequest.values`. `game-vfx-three` draws the solid particles (`workshop-meshes`) and passes `orientation` and `values` on. `game-weapons-three`: `createWeaponFx({ effects })` and `createViewmodel({ effects })` play those recipes through the host's effect sink; without a sink the viewmodel makes a world of effects of its own (new dependencies on `game-vfx` and `game-vfx-three`). Casings, magazines, the flying rocket and the burning droplets stay as they were.

## 0.12.0

### Minor Changes

- 98ae206: `ModuleHost.addBlocker(blocked)`: a module with walls of its own (a house) keeps the walking player out of them; the function is asked on every step with the player's radius and may follow a door that opens. `ModuleHost.onClear(listener)`: a module that put things in the world on its own follows the room clearing its area (`clear()`, opening an area, scenarios) to take them away. Both optional; the room lends them.

## 0.11.0

### Minor Changes

- 968d7df: Blast contracts, additive: `BlastOptions` (`shelter`, `fragmentHits`, `confinement`), `ShelterOptions`, `FragmentHitOptions`, `ConfinementOptions`, `BlastReport`; `Hit.blast`, `Hit.confinement`, `Hit.shelter`, `Hit.piercing`; `HitResult.blast`; the `blast` and `fragment_hit` events.

## 0.10.0

### Minor Changes

- 7fd46fb: Sound and weather contracts, additive and generic. `AudioSink` (`play(SoundRequest)`, `stop`, optional `loop`, `setListener`, `register`) and `ModuleHost.audio?`; `EnvironmentState` (rain in mm/h, wind, fog, visibility, night factor, temperature, wetness), `EnvironmentBus` (`get`, `set`, `on`), `createEnvironmentBus` and `DEFAULT_ENVIRONMENT` (the calm dry day), and `ModuleHost.environment?`. A module that makes sound or reacts to the weather uses what the host lends and works without it.

## 0.9.0

### Minor Changes

- cb85470: Effects the host lends, types first (T5.1a). New `EffectSink` (`play`, `stop`, and optional `configure`, `stats`, `catalog`), `EffectRequest` and `EffectHandle`, and `ModuleHost.effects`. The `explosion` `HostEvent` gains `explosive` (the id of the explosive), `PartSpec.explodes` gains `effect` and the `explode` destruction event carries it. The bench gains `ChoiceOption.group` (options listed under a heading; `checkBench` rejects a group that is split or empty) and `ModuleBench.sheet(BenchSheet | null)` with the `BenchSheet` card (kicker, title, body, facts, steps, swatches, note and a timeline whose playhead follows a module metric). All additive; a host that does not lend `effects` or `sheet` keeps working.
- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).

## 0.8.0

### Minor Changes

- 76d15b6: Contrato do corpo vivo (fase 4): `body.ts` com `BodySlot`, `SegmentKind`, `BodyRegion` e `MISSING_BITS`; `Hit.mass`, `Hit.cut` e `Hit.part`; evento `body`; `ObjectState.body`. `Shot.mass` (gramas do projétil) sai das armas e `shotToHit` copia para o `Hit`. O `game-destruction` ganha o rótulo do evento `body` nos dois idiomas.
- cc182c7: Contracts: `Thumbnail` (`svg` or `render`, with `yaw`, `pitch`, `distance` and `wear`) and `TestableItem.thumbnail`; the registry helpers `mergeById`, `applyPatches`, `removeIds`, `deepMerge` and the `DeepPartial` type now live here so every catalog package merges packs the same way. Interactables: `ItemDef.thumbnail` and a dependency on the contracts. Weapons: imports the helpers from the contracts (public API unchanged).
- 9e58b50: Contratos de parede em camadas e estágios de dano (todos opcionais): `PartSpec.layers` (`SurfaceLayer`), `reinforcement` (`Reinforcement`), `units` (`PartUnits`) e `breach` (`PartBreach`); `PartState.stage` (`DamageStage` 0 a 3), `stripped` e `opening`; `Fragment.marks` (`FragmentMark`); eventos `spall`, `stage` (com `opening` e `fragments`) e `expose`. `checkSpec` valida os campos novos. Módulos existentes compilam sem mudança.

## 0.7.0

### Minor Changes

- 572f2fa: Item thumbnails. `game-contracts`: `TestableItem.thumbnail?` (an image URL or inline `<svg…>` markup), optional and additive. `game-test-room`: `TestRoomItem.thumbnail` and `InspectInfo.thumbnail`; the room draws the picture above the name in the catalogue buttons, in the search results and in the inspector of the aimed item, as a CSS mask over the text colour (a one-colour SVG follows the theme, tones go in opacity; an item without a thumbnail shows its name only).

  `game-weapons-three`: a thumbnail for every weapon of the arsenal and for the explosives that stand in the world. `assets/weapon-svg/generated/` holds a side-profile silhouette of the 3D model of each one (4:1, `currentColor`, deterministic, about 2 KB each), `commons/` the outline of a freely licensed Wikimedia Commons drawing where one was found (its own licence, see `LICENSE-NOTE.md`, `CREDITS.md` and `manifest.json`); `WEAPON_THUMBNAILS`, `weaponThumbnailUrl(id, base?)` and `DEFAULT_THUMBNAIL_BASE` resolve them (Commons first), and `createWeaponsTestModule({ thumbnailBase })` fills `TestableItem.thumbnail` (default `weapon-svg/`, `false` for none). The package now publishes `assets/`. The site build copies the folder to `site/dist/weapon-svg`.

## 0.6.0

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

## 0.5.0

### Minor Changes

- d10c7f7: Contracts for explosives and chain reactions. `Use` of kind `throw` carries the explosive it throws (`explosive`, `trigger`, `armDistance`, `injuryRadius`, `stunSeconds`) and there are two new kinds: `place` (a mine or charge set down that waits for a wire, a remote detonator or a timer) and `backblast` (the danger zone behind a rocket launcher). `PartSpec.explodes` takes `chain` (`ExplosionChain`): what sets the part off before it is destroyed (`shot`, `fire`, `explosion`) and the seconds until the blast. `DestructionEvent` has a new `primed` event for it. All additive; a host that switches over `Use` or the events needs no change.
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
- c0fcb62: Animation contract for the tool in hand. `HostEvent` gains `cycle`, `stage` and `feed`, and `tool`, `reload` and `clear` carry the seconds the rule gave
  the phase (`duration`, from the weapon `phase`) and the reload `kind`. `game-contracts` adds `toolAnimationStep` (event to move: `play`, `sync`,
  `finish`), `TOOL_CLIP`, the renderer-free `createToolClipPlayer` (scales a clip to the duration of the rule, moves a `ToolRig`, fires clip events, jumps
  to the marker of a reached stage), `scaleClip`, `sampleClip` and `checkToolClips`. The test room now passes the whole weapon cycle to the host.
  Breaking for hosts that call `toHostEvent` directly: the third parameter is an options object (`{ recoil, phase }`).

### Patch Changes

- b3a5d99: Launchers, throwables and flamethrower with the rule of the team deliveries. A launcher returns the projectile (`throw` with `explosive`, `trigger: 'impact'`, `armDistance` 10 m) and the `backblast` (5 m, 19° cone); `arsenal.explosiveBody(use)` flies it with gravity, bounces, counts the fuse, arms by distance (a hit before it is a `dud`) and returns `detonate` with everything a host needs; `blastEffect` and `backblastEffect` say who is in the lethal or injury zone (cone of the Claymore, stun of the flashbang). Throwables follow their `ExplosiveDef` (fuse, fire, energy): the molotov now leaves fire of 4 m for 9 s instead of 1.5 m for 12 s. New throwables `flashbang`, `dynamite`, `c4` and `claymore` (`place` use for the last two). `ExplosiveDef` has `chain` (delays of the chain reaction of the world explosives) and the trigger `explosion`; `WeaponRules.explosives` holds gravity and bounce; `weapon.ts` is split into `weapon-core`, `weapon-commands`, `weapon-firearm` and `weapon` without change of behaviour.
- 85ac930: The tool clip player carries the remainder of a frame into a repeated round that leaves its delay in the middle of it (`time += dt - delay`), so the pose no longer depends on the frame step; `scaleClip` no longer yields NaN for a clip of no duration and `checkToolClips` reports one. Noise bursts of the weapon audio start where they can play whole in the 1.5 s buffer. The cone of a directional charge reaches an object by its bounding box instead of its origin.

## 0.4.0

### Minor Changes

- 71fb367: Module bench: a `TestableModule` can declare `controls` (number, boolean, choice, action), `layers` and `metrics` as data, checked by
  `checkBench`; the host lends a `ModuleBench` (`host.bench`) with the values, the changes, `patch` and `look`. Tool events gain the generic
  cycle names `mode`, `fault`, `clear` and `safety`, and `shot` carries `rounds` and `mode`; `HostTool` may report `mode`, `fault`, `safety` and
  `heat`. The test room keeps a bench per module, draws it in a new panel (controls, layers, counters with budget bars, and a line of room
  counters: fps, frame time, draw calls, triangles, objects, fragments, particles, decals), exposes `room.bench()` and `room.metrics()`, encodes
  the state for a page URL (`bench` option, `encodeBenchState` / `decodeBenchState`), emits `mode` on Q, and detaches a module before attaching
  it again.

## 0.3.0

### Minor Changes

- 6022fe5: `TestableModule` can bring its own area (`area`: where each item goes, surfaces things rest on, props that start asleep, the starting view) and
  its own presentation (`attach`, with a `ModuleHost`: scene, camera, ground height, tool events `tool`/`shot`/`reload`/`empty` and a per-frame
  callback). Both optional and generic: nothing in the contracts is specific to a kind of module.

## 0.2.0

### Minor Changes

- 5603151: New part status `'collapsed'` (added to `PartStatus`). Every part that is reported in a `collapse` event and was not already broken, melted or ash gets `status: 'collapsed'` instead of staying `intact`/`damaged`; it is kept by `serialize`/`load`, cleared by `reset`, and the part becomes `broken` if it later fractures. `partStatus` locale tables gained `collapsed` (`desabado`). A collapsed part still exists as a piece, so code that treats `broken`, `melted` and `ashes` as lost needs no change; exhaustive switches over `PartStatus` need a new case.

### Patch Changes

- 4babeca: Overloaded structures now fail on a game-feel timescale. The overload damage was proportional to the excess alone (`(stress - 1) * maxHp * 0.5` per second), so a part at stress 1.02 took about 100 s to give way and a cascade of slightly overloaded columns took 30-70 s. It is now `min(0.6, 0.12 + 0.8 * (stress - 1))` of `maxHp` per second: stress 1.02 gives way in about 7 s, 1.1 in 5 s, 1.5 in 2 s and anything above 1.7 in 1.7 s (it was 0.3 s at stress 8: very high stress is slightly slower now). Still deterministic. Hosts that tuned capacities around the old timing may see structures fall sooner.

## 0.1.1

### Patch Changes

- 930b9ab: Add `checkSpec` to game-contracts; `loadModule` runs it for every item with a spec (given, a function, or derived) and logs ✓/✗/⚠ lines.
- 632a45a: Add `DestructionWorld.setPartPose` (and the optional `DestructibleImpl.setPartPose`) so animated parts keep their collision and raycast shape in sync; the test room calls it for every animated part.

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
