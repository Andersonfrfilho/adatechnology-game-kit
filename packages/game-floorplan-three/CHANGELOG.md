# @adatechnology/game-floorplan-three

## 0.11.1

### Patch Changes

- Updated dependencies [c4b8218]
- Updated dependencies [a6a6a8f]
- Updated dependencies [49272b6]
  - @adatechnology/game-contracts@0.30.0
  - @adatechnology/game-destruction@0.20.0
  - @adatechnology/game-floorplan-structure@2.1.5

## 0.11.0

### Minor Changes

- 8888b33: The outer baseboard of the houses (and of `wallPiece`) is a destructible band of glazed ceramic tiles instead of decoration: each band is a piece of its own (`baseboard:<wall>:<side>`, `ceramic`, the mass of 12 mm of tile and adhesive), laid in 0.6 m tiles as its units (`BASEBOARD_TILES`) and glued to its wall. A shot craters the tile where it lands (and the round goes on into the wall), a kick or a nearby blast cracks the glaze with the ceramic's own sound, a charge against it shatters it, and it comes off when its wall goes.

### Patch Changes

- 41760ac: Broken objects: nothing floats, nothing invisible collides. After each break the renderer checks what is left of the object on the next update (`onBrokenChecked`)
  and lets go at once what stood on something and lost it; whatever is not a structure loses its footing by the same rule as furniture. What lay asleep on a piece
  wakes in the same update that piece starts to move. `shownBoxes(objectId, partId?)` gives the world boxes of what is still drawn. The test room measures the player
  against those boxes (a broken leg leaves no collider), logs a `broken_floating` failure when the check had to let something go, and looks for what a thrown body
  hit from the hip to the shoulder. The floor plan's golden hashes of the two house destruction scenes change: debris asleep on pieces that move now wakes.
- e8cae79: A piece's contacts follow the surface it rests on: on another piece the push is along the normal of that piece's face (a tilted table top pushes across itself,
  not straight up), and friction is Coulomb in the plane of the surface, static while the point holds and dynamic while it slides (0.7 and 0.6 unless the piece
  says otherwise, mixed by geometric mean between two pieces). A box on a top tilted past atan(μ) slides down it toward the low side; gentler, it stays. Pieces on
  the top of another are no longer pushed sideways off it by the separation of pieces side by side. The floor plan's golden hashes of the three house destruction
  scenes change with the solver.
- Updated dependencies [a3b0fd7]
- Updated dependencies [b1f747f]
  - @adatechnology/game-destruction@0.19.0
  - @adatechnology/game-contracts@0.29.0
  - @adatechnology/game-floorplan-structure@2.1.4

## 0.10.3

### Patch Changes

- Updated dependencies [624ee79]
- Updated dependencies [b6677b5]
- Updated dependencies [d3f6983]
  - @adatechnology/game-contracts@0.28.0
  - @adatechnology/game-destruction@0.18.2
  - @adatechnology/game-floorplan-structure@2.1.3

## 0.10.2

### Patch Changes

- Updated dependencies [49b8d77]
  - @adatechnology/game-contracts@0.27.0
  - @adatechnology/game-destruction@0.18.1
  - @adatechnology/game-floorplan-structure@2.1.2

## 0.10.1

### Patch Changes

- Updated dependencies [dbc0ef3]
- Updated dependencies [c8b0e40]
  - @adatechnology/game-destruction@0.18.0
  - @adatechnology/game-contracts@0.26.0
  - @adatechnology/game-floorplan-structure@2.1.1

## 0.10.0

### Minor Changes

- 8c11843: The first shot or blast on a wall no longer builds shader programs in play. `wallPiece` gives `warmUpProbes(THREE)`: the wall drawn with one brick shot out of it (the breach's shell and its bare bricks, instanced, lit and in the shadows), for a host to draw once at load; its `dispose` frees geometries and textures and leaves the materials to the host's warmup, which keeps the programs alive. A room's `SceneryObject` takes `warmUpProbes`, and the room draws them with its other probes; the test room passes the target wall's.
- f362db3: Structural validation and confined masonry. `validateStructure(structure, { doors, wallDetail })` and `validateSpec(spec)` return what a structure gets wrong as a real building, as typed violations with stable codes (`STRUCTURAL_VIOLATION`: load paths, NBR 6118 sections and steel, beam depth L/10, long beams on masonry, ground beam, pillars at ends, corners, junctions and every 4 m up to the bond beam, bond beam, lintel and sill beam, bonded bricks, plaster on both faces). Masonry houses on strip footings stand on reinforced concrete ground beams (`ground_beam_*`, `GROUND_BEAM_DEPTH`, anchored foundation in the spec; `groundBeams: false` leaves them out), every window gets a sill beam (`_sillbeam_`, `SILL_BEAM_DEPTH`) and lintels and sill beams bear on the jamb pillars, lintels are at least L/10 deep, wide doors get jamb pillars (`jamb_column_*`), short piers keep their jamb pillar, raised tank and balcony pillars are 0.2 m (`TANK_PILLAR_SIDE`; `visorSections: true` keeps the Visor's sections for the team's golden). The house renderer draws the pillars in the walls as structure, plastered a shade off the facade and 2.5 cm out of each face (`BuildOptions.pillars`, `'hidden'` as the Visor drew them).
- 1a5d6fc: Masonry walls stand on concrete pillars along their length, as in confined masonry: besides the corner pillars, every exterior masonry wall gets a 0.2 x 0.2 m reinforced concrete pillar at its free ends and door jambs, beside each window, where another wall meets it and at most every `WALL_PILLAR_SPACING` (4 m), from the floor to the bond beam, which rests on them (`StructureOptions.wallPillars`, `false` for the corner pillars alone; the free-standing `wallPiece` has four). The house renderer draws them under the wall's plaster: a shot or a blow that takes out the plaster and bricks next to one shows its concrete (and its bars when the concrete goes), the bricks stop at its faces, and a brick wall that falls leaves the pillars and the bond beam standing.

### Patch Changes

- fb985db: A blast breaks a masonry wall only where it reaches: the units within the circle its reach cuts on the wall (by the cube root of the energy and of how much the wall resists) come out with a ragged edge, the units past it are loosened for the next blow, and what the hole leaves with nothing under it comes down (`unsupportedCells`: the triangle over the hole, all that hangs at a free end). The rest of the wall stands, and later shots and blasts keep cutting it. A blast loosens a long joint only over the stretch it breaks, so a grenade no longer opens the bed of a ten-metre wall and drops it whole. Everything a blast knocks out comes in one `chip` with `units` (new optional field), painted once by the house renderer. The ground takes the soot of a blast's fireball by its material (`fire.maxScorch`: concrete soots, turf chars).
- 54a1bcb: A wall that comes down after the house drew its holes no longer leaves as an invisible piece: the house renderer keeps the plain positions of the ranges it collapses (`userData.plainPositions`), and the destruction renderer draws them again when the part leaves the mesh (`showCollapsedRanges`, and `extract` for ranges of a merged mesh). The fallen wall is drawn where the world has it, so shots hit only what is drawn and its bullet marks stay on it instead of floating in the air.
- bf407ec: A reinforced member cast round its cage (a pillar or beam in concrete blocks) is cut through by a blast only at or near contact (`MEMBER_CUT_REACH`, half the breach reach); further off the blast takes the concrete it reaches out of it block by block and the cage holds it to what it rests on. The bare cage of a pillar keeps what its bars carry (`cageResidualCapacity`: perimeter bars by the steel's crushing strength, halved for buckling) instead of a flat 15%, so the end pillar of a wall stands on its cage under a light bond beam.
- Updated dependencies [fb985db]
- Updated dependencies [d9f3302]
- Updated dependencies [5a66d40]
- Updated dependencies [61a4a79]
- Updated dependencies [f362db3]
- Updated dependencies [1495684]
- Updated dependencies [02b8ea2]
- Updated dependencies [bf407ec]
- Updated dependencies [1a5d6fc]
- Updated dependencies [78e76b0]
  - @adatechnology/game-contracts@0.25.0
  - @adatechnology/game-destruction@0.17.0
  - @adatechnology/game-floorplan-structure@2.1.0

## 0.9.3

### Patch Changes

- Updated dependencies [157b90d]
  - @adatechnology/game-render-three@0.2.0

## 0.9.2

### Patch Changes

- Updated dependencies [8f07024]
  - @adatechnology/game-contracts@0.24.0
  - @adatechnology/game-destruction@0.16.0
  - @adatechnology/game-floorplan-structure@2.0.2

## 0.9.1

### Patch Changes

- Updated dependencies [a27d5ae]
- Updated dependencies [672f918]
- Updated dependencies [ebb9479]
- Updated dependencies [29782fc]
- Updated dependencies [11308d7]
- Updated dependencies [9314e78]
- Updated dependencies [f5cc423]
- Updated dependencies [106c0f5]
- Updated dependencies [9a151ad]
  - @adatechnology/game-contracts@0.23.0
  - @adatechnology/game-destruction@0.15.0
  - @adatechnology/game-floorplan-interactables@1.0.0
  - @adatechnology/game-floorplan-residential@6.0.1
  - @adatechnology/game-floorplan-structure@2.0.1
  - @adatechnology/game-shapes-three@0.3.1

## 0.9.0

### Minor Changes

- ce94d04: New optional options that take content by option (spec 005, D1 and D7). Every call written before keeps working: the default is the content pack the adapter always used, it is deprecated, and it will be removed in the next major.

  - `game-characters-three`: `toRoomAvatar(avatar, { strikeClips, firstPersonClips })`; the defaults are `ATTACK_CLIPS` and `FIRST_PERSON_CLIPS` of `game-characters-people`. Recommended: spread `defaultCharacterClips()` of `@adatechnology/game-kit-defaults`.
  - `game-floorplan-three`: `furnitureSpec(THREE, type, { catalog })`; the default is `residentialItems`. Recommended: `defaultFurnitureCatalog()`.
  - `game-vehicles-three`: `createVehiclesThree(THREE, { kit, fleet })` and `createVehiclesTestModule({ fleet })` (`VehicleFleetContent`, `VehiclesTestFleet`); the default is the fleet of `game-vehicles-fleet`. Recommended: `defaultVehicleFleet()`.
  - `game-vegetation-three`: `createVegetationTestModule({ GameVegetationSpecies })` keeps its default `game-vegetation-species`; recommended `defaultVegetationSpecies()`.

  `game-props3d` is now a shared builder, not content (spec 005, D1): the layer rules let content, cores and adapters import it. Its deprecated `mergeByMaterial` re-export stays until the next major.

- cbb20a2: The kit's deferred work can share one frame budget. `engine.deferredQueue()` (voices), `renderer.deferredQueue()` (destruction events and slices), `houseRenderer.deferredQueue()` (breach paint) and `createCreaseQueue()` with `VehicleDestructibleOptions.creaseQueue` (vehicle crease, one queue for every vehicle, round robin) give a `DeferredQueue` that `@adatechnology/game-runtime` runs inside its budget. Nothing changes without a budget: the queues keep draining by themselves and `deferredStart`, `eventBudgetMs`, `breachPaintBudgetMs` and `pump()` keep their meaning and defaults. The test room runs on the scheduler, registers the voice and destruction queues, lends `host.defer` and `onFrame(fn, { phase, order })`, and gains `frameBudgetMs` and `frameStats()`.
- f48b676: Lights go through the `LightBudget` of `game-render-three` (spec 005, D4 and D2). New optional `lights` (a `LightBudget`) on `createVfxRenderer`, `HouseRenderer.lighting` (`budget`), `createWeaponFx`, `createMeshApi` and `createThreeAdapter`, `createPersonBuilder`, `createWeatherRenderer`, `createHeadlights` (rules), `createLightning` and `createUrbanThree`: blast, fire and Workshop lights, the rooms' lights (their masks are written at `handle.slot`, which fixes the 12-entry mask), the rocket, the weapon light, the lamps, the flare, the headlights, the lightning flash (a leased hemisphere slot) and the street lights become requests or sources of the budget, so no light appears or goes while the game runs and no lit material recompiles. Without the option every package creates its own lights as before; that path is deprecated and goes in the next major, and the goldens that read light nodes stay on it. `ModuleHost` gains `lights` and `pools` (`unknown`: read them with `isLightBudget` and `isRenderPools`), the test room creates both and exposes `lights` and `webgl`. `game-urban` renames its counter to `LightAllowance`/`createLightAllowance`/`DEFAULT_LIGHT_ALLOWANCE` (the old names stay, deprecated). `game-render-three` gains `shadowSettings` and `LightLease.invalidateShadow`. `game-vehicles` takes `particleMaterials` (a structural pool) so the puffs' shader programs survive them; `game-weapons-three` takes `pools` for the flamethrower droplets and ground flames. The lint rule that forbids creating a light outside the budget is now an error.
- 455522d: New `./testing` subpath on each package that ships a test area or bench (spec 005, D6): `import { createXTestModule } from '@adatechnology/game-<pkg>/testing'`. The test areas, benches and their texts moved behind it so the runtime entry does not carry them. Nothing is removed: every export that used to be on the package root is still there, `@deprecated`, and will be removed in the next major. The ESM build splits chunks (`splitting: true`), so the root and `./testing` share one copy of the module-level registries.

### Patch Changes

- Updated dependencies [15046ce]
- Updated dependencies [3dbca8c]
- Updated dependencies [455522d]
- Updated dependencies [7b77aa7]
- Updated dependencies [41b9dd4]
- Updated dependencies [6489939]
- Updated dependencies [3a46bd0]
- Updated dependencies [d97cf9f]
- Updated dependencies [05fbba9]
- Updated dependencies [351d09e]
- Updated dependencies [b97f318]
- Updated dependencies [f48b676]
- Updated dependencies [fab813c]
  - @adatechnology/game-contracts@0.22.0
  - @adatechnology/game-destruction@0.14.0
  - @adatechnology/game-shapes-three@0.3.0
  - @adatechnology/game-render-three@0.1.0
  - @adatechnology/game-floorplan-structure@2.0.0
  - @adatechnology/game-props3d@0.3.3
  - @adatechnology/game-floorplan-residential@6.0.0

## 0.8.3

### Patch Changes

- Updated dependencies [379e44f]
  - @adatechnology/game-contracts@0.21.0
  - @adatechnology/game-destruction@0.13.2
  - @adatechnology/game-floorplan-structure@1.3.3

## 0.8.2

### Patch Changes

- 94f98a3: Memory leaks fixed: what leaves the scene frees its GPU side. New `releaseObject3D` and `discardObject3D` (game-shapes-three) free the geometries, materials, textures and skeletons of a removed tree, keeping what the scene still draws. The test room uses them when it clears or removes things (items, loose pieces, projectiles and charges), the explosives bench frees its blast rings (two canvas labels each) and launched shells, the flying pieces of cut bodies and the ejected rounds free their own geometry, a shattered car pane frees its crack texture, and the characters area stops tracking the wounds of bodies that left the room (each one kept its whole rig in memory). The test areas of cars, plants, the city, animals and items free their helper layers and forget the items that left the scene, and the house scenarios stop listening to the world when they end (each run left a listener collecting every later event). New `markShared` marks resources shared without touching them, and the weapon model kit marks its materials and cached boxes with it, so a weapon put away does not free them for the next one.
- Updated dependencies [94f98a3]
  - @adatechnology/game-shapes-three@0.2.0
  - @adatechnology/game-props3d@0.3.2

## 0.8.1

### Patch Changes

- 22d2135: Shots at the corners and ends of a wall no longer draw anything outside it. The structure's part of a wall reaches half the thickness past each end (to close a corner), and the breach view laid its bricks and bond-beam blocks on that part, so a hit near an end drew a grey block (the bond beam's concrete) and bricks up to 8 cm past the wall's edge. The units laid bare are now clipped to the box of the wall as the house drew it (`clipToBox`).

  A shot near a free side of a unit tears the corner off out to that side instead of leaving a crater inside it: the ends of the wall, its top, and the side a unit already knocked out left open, so the edge a torn corner leaves tears off in turn. How close counts grows with the round's energy (1.5 crater widths: about 11 cm for a 7.62, 7 cm for a 9 mm).

- Updated dependencies [22d2135]
  - @adatechnology/game-destruction@0.13.1

## 0.8.0

### Minor Changes

- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- 4eb330f: A shot breaks a brick or a concrete block where it lands instead of knocking the whole unit out: a crater a few centimetres across goes through the unit (about 6 cm for a pistol round, 10 for a rifle round), the rest of the unit stays, and small bits of the inside of the material fly out of both faces, most out of the far one. The rest of a unit comes out, in pieces, only once its craters took most of it. A wall, a partition or a column now loses its section across one height, so a slot shot along the base of a wall brings it down while the same rounds spread over its face leave it standing. The house renderer draws each crater as an irregular hole through the unit with the plaster broken off around it, and the marks of a shot (bullet holes, spalls) now sit on the face as drawn, not a few millimetres behind it.

  A pistol round on a plastered brick wall no longer draws a star of cracks and a flat orange disc: the plaster comes off in a ragged patch drawn by the house renderer, with the brick and its mortar under it and the bullet hole on the brick (the destruction renderer leaves its patch out on meshes marked `userData.drawnSpalls`). The destruction renderer also keeps ranges another drawing collapsed (`userData.collapsedRanges`) when it rewrites a merged mesh, so a broken wall comes back after a reset.

  The other materials take a round the same way: the concrete laid bare in a wall is one face with no joints, an opaque brittle body (a ceramic tub) cracks a hand around the hit in a dark shade of its own colour instead of black lines across the piece (glass keeps its long white cracks), and a hole in wood has a rim of torn fresh wood under it.

### Patch Changes

- 9c63053: A shot into MDF or wood left no hole: the lumps it tore off came as a `chip`, and the renderer cleared every mark inside it as if a brick had left the wall. The `chip` of what a blow tore off a face now carries `torn: true`, and the renderer and the house breach keep the hole and its marks.
- Updated dependencies [0c67a15]
- Updated dependencies [b818f6a]
- Updated dependencies [9e0aa58]
- Updated dependencies [7051d83]
- Updated dependencies [a1ce099]
- Updated dependencies [5a2f8e7]
- Updated dependencies [b58423f]
- Updated dependencies [53babb5]
- Updated dependencies [4eb330f]
- Updated dependencies [711af5d]
- Updated dependencies [9c63053]
- Updated dependencies [7ca2f8e]
- Updated dependencies [f8c2b21]
- Updated dependencies [3642202]
  - @adatechnology/game-contracts@0.20.0
  - @adatechnology/game-destruction@0.13.0
  - @adatechnology/game-floorplan-structure@1.3.2

## 0.7.0

### Minor Changes

- 2a1bb17: Wall damage stays where the shot lands. The house no longer redraws a whole wall as plain white blocks on the first brick that comes out: the wall keeps
  its geometry, plaster and paint, and is cut by a mask only where units came out, with a ragged edge of plaster and the bricks (in their mortar) or the
  rough concrete of a beam showing around the hole. Bullet holes, spalls and the impact marks of the effects go with the brick that comes out
  (`DecalPool.clearInside` in game-vfx). A bullet now wears only its stretch of a joint (`BULLET_JOINT_SPAN`), so a row of shots along a ten-metre wall no
  longer opens the whole mortar bed and brings the wall down.

### Patch Changes

- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0
  - @adatechnology/game-floorplan-structure@1.3.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@5.0.0

## 0.6.0

### Minor Changes

- 2c9c963: Concrete answers each kind of blow its own way. `MaterialDef.hits` says, per damage type, what a blow takes out of a material: `unitJoules` (joules per kg of a unit to knock it out), `floor` (joules of each blow that only scar the surface) and `crater` (a crater in the bare surface, a `spall` with `layer` -1). Concrete: a 9 mm round only craters it with dust and chips; rifle rounds knock its blocks out (about three 5.56 or two 7.62x39 per block); a fist takes nothing. A reinforced part now loses blocks too: the bars inside each block that came out show (`expose` carries every bar that shows), the cross-section shot away at one place lowers what the part carries (down to its cage), and the bars of an overloaded part bow more at each `stress` until it gives way. The houses' concrete beams and pillars are made of 0.1 m blocks around their cage (`MEMBER_CAGE`), and the house renderer opens the gaps in a bond beam it draws inside the wall's plaster.
- 31fc87d: Each material answers each kind of blow its own way. New `MaterialDef.hits` (material × damage type): what a blow tears out where it lands (`tear`: `splinters`, `lumps`, `none`) and the joules per piece. A round into wood tears splinters of fresh wood out of the exit (and back out of the entry), MDF crumbles lumps, plywood splinters; a punch crumbles MDF, a kick splinters pine, hardwood and steel tear nothing. Snapping boards (MDF, plastic) also break where they are shot. `innerColor` for wood, plywood and MDF. Cases with shelves (`furnitureSpec`) are MDF.

  Loose pieces land on what is under them: on other pieces and on the drawn meshes of fixed objects (`PieceSystemOptions.staticTopAt`), so a falling shelf rests on the books below and a tipping panel on the chair in front. New `DestructionRenderer.solidsNear` gives the drawn boxes around a point. The test room's player walks by them: steps onto low debris (up to 45 cm), stops at taller things and kicks light pieces (books, boards) out of the way, instead of the scenery's old footprints.

- 31fc87d: A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

  `DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

  The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.

  Furniture that comes apart no longer leaves anything fixed: what stayed standing becomes a piece too, and a piece whose feet are too close for its height (a lone leg, a board on two legs in a line) falls over until it lies.

### Patch Changes

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-floorplan-structure@1.3.0
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@5.0.0

## 0.5.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0
  - @adatechnology/game-floorplan-structure@1.2.3
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.2

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0
  - @adatechnology/game-floorplan-structure@1.2.2
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.1

### Patch Changes

- df42f4b: Every builder of the kit marks what it draws with its origin (`markKitOrigin`, `kitOriginOf`, `unmarkedDrawings` of `game-contracts`): a car of the fleet, a house or wall, a piece of furniture, a person, an animal, a plant, an item (and whether it is still a stand-in shape), a weapon, the street, effects and the room. The test room lists its modules (`room.modules()`), and `tools/kit-audit/scene.mjs` opens each area and fails on anything drawn on the spot instead of coming from the SDK that owns it.
- Updated dependencies [df42f4b]
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-destruction@0.8.2
  - @adatechnology/game-floorplan-structure@1.2.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.4.0

### Minor Changes

- 5b69fc2: `wallPiece` and `wallPlan`: a free-standing wall built and drawn as the walls of the houses (the houses' structure without a roof, drawn by the house renderer). `buildStructure` takes `roof: false`. The test room's target wall is now one of them.

### Patch Changes

- Updated dependencies [5b69fc2]
  - @adatechnology/game-floorplan-structure@1.2.0
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@4.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1
  - @adatechnology/game-floorplan-structure@1.1.1
  - @adatechnology/game-floorplan-interactables@0.1.0
  - @adatechnology/game-floorplan-residential@3.0.0

## 0.3.0

### Minor Changes

- fa6ea00: Structure: a slab or beam is held by the sum of its supports (documented and tested: four columns share the load, each loss moves it to the rest, the
  slab falls when the capacity left is less than the load). New world option `structure: { safetyFactor }` (default 1) multiplies every load before it
  meets the capacities. `game-floorplan-three`: `SpecimenDef.sizing` (`safety`, `redundancy`, `safetyOthers`) sizes a specimen; the frame house of the
  area (`house_casa_portico`) is sized at 0.72 / 0.97 (four pillars: one lost 0.96, two lost fall), so `house_two_pillars` passes with the team's own
  sequence (two pillars) in the real room, and the extended hit sequence the module used as a workaround is gone.
- 945d00d: A loading indicator for any slow job of the test room: `room.loading` / `room.busy(label, work)` / `room.openAreaAsync(area)` (spinner or bar, text in the room's locale, nothing drawn with `ui: false`), the generic `BusySink` contract and `ModuleHost.loading`, `ModuleControl.slow` and `TestableItem.slow` so the room's panel and catalogue run a slow press or spawn behind it, and `LOADING_CSS` / `loadingMarkup` for a page's first frame. The house bench rebuilds, the nursery lot, the walker, the crowd, the skins and the vehicles use it.
- 89807ec: Houses and buildings of concrete are real structures in flexure (T10 §12). `game-floorplan-structure`: `toDestructibleSpec` cuts each concrete slab into panels of at most
  `maxSpan` (5 m) with real beams (`h = span / 10`, at least 25 cm), slabs of `L / 40` (at least 10 cm for a floor, 8 cm for a roof), 20 cm pillars where a beam or bond beam
  spans more than `maxSpan`, and lintels and bond beams as deep as their span (`slabPanels`, `SLAB_PANEL_DEFAULTS`, `resolveSlabPanels`, `applySlabPanels`, `slabPanelView`,
  `beamSpan`, `beamDepthFor`); `StructurePart` gets `footprint` and `slab`. The tension steel is now declared and sized by default (`rebar: true`; `rebar: false` or
  `slabPanels: false` give the spec the Visor de casas 3D describes), so the 28 typologies stand at rest and losing one pillar of a framed house no longer drops its slab.
  `game-floorplan-three`: a house bound to a destruction world is drawn by slab panel (floors, ceilings and flat roofs per panel), without a world it is drawn as before; the
  test area's `house_two_pillars` loses the two pillars at the ends of one side. `game-destruction`: a blunt blow on the terrain (an anchored part tagged `terrain`) no longer wears
  the joints of every wall standing on it.

### Patch Changes

- dacab65: O three do núcleo é o `shapeGeometries(THREE)` do game-shapes-three: os modelos de primitiva do acumulador, as unidades da ruptura, os fragmentos, os espelhos e os espécimes da área de teste saem do game-shapes, iguais bit a bit e com cache por parâmetros entre renderizadores.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [e4663e1]
- Updated dependencies [1b1d611]
- Updated dependencies [9f7dadf]
- Updated dependencies [d610199]
- Updated dependencies [fa6ea00]
- Updated dependencies [9b27571]
- Updated dependencies [f62305b]
- Updated dependencies [945d00d]
- Updated dependencies [024d0e8]
- Updated dependencies [20cc300]
- Updated dependencies [89807ec]
- Updated dependencies [d24de8a]
- Updated dependencies [cd2d333]
- Updated dependencies [e9a0932]
- Updated dependencies [fcd0be6]
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [5af569f]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-floorplan-structure@1.1.0
  - @adatechnology/game-floorplan@0.2.2
  - @adatechnology/game-floorplan-residential@3.0.0
  - @adatechnology/game-props3d@0.3.1
  - @adatechnology/game-shapes-three@0.1.1
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.1

### Patch Changes

- Updated dependencies [e29f38d]
  - @adatechnology/game-props3d@0.3.0
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.2.0

### Minor Changes

- 1cb7dc8: New package `@adatechnology/game-floorplan-interactables`: the team's `AdaptadorInterativos` ported (plan to objects of the interactables kit, wiring, gas, water, chairs, contents, doors fitted to the walls), every table a registry. `game-floorplan-three` uses it as the default of `interactives` (`adapter` still injects another, `adapterOptions` goes to `create`) and the bridge no longer misreads the plan (`floorY`, `panel`, `mats.floor`).

### Patch Changes

- Updated dependencies [1cb7dc8]
  - @adatechnology/game-floorplan-interactables@0.1.0

## 0.1.1

### Patch Changes

- Updated dependencies [f49e466]
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2
  - @adatechnology/game-floorplan-structure@1.0.5

## 0.1.0

### Minor Changes

- bc11c7f: New package: the three.js renderer of `@adatechnology/game-floorplan` (spec 001, T2.4), a literal port of the team's `Casa3DSDK` and `AndaresSDK`. `create(THREE, options).build(plan)`
  draws walls, doors, windows, floors, slabs, stairs, roofs, gutters, lot, furniture (`game-props3d`), lights, mirrors, cars, solar panels, water and electrical. Each piece knows its vertex
  range in the merged mesh, so the house binds to the destruction of its structure (`game-destruction`, `game-destruction-three`): fracture and collapse hide the range, a masonry wall that reaches
  stage 2 is drawn again as instanced brick courses at LOD 0, and the renderer adds the spall decal and the rebar cage. `createFloorNavigator` is the AndaresSDK (10 cm grid per floor, stairs, occlusion),
  with `navigationDefOf` and `bindNavigator` to register a built house and follow its destruction. The scene equals the page's, node by node, for six plans (golden `vc3-house-scene.json`), and `planLod`
  gives the same levels. Fleet, interactables, vegetation and the mirror's `Reflector` are injected; texts come from `locales` (`en`, `pt-BR`); global `GameFloorplanThree`.
- 4c38dd2: Módulo de teste da casa para a sala de testes (`createFloorplanTestModule`): escolha de pacote, tipologia, semente e estado, casas construídas no mundo de destruição da sala, paredes que barram o jogador, porta com E, andares, nível de detalhe por orçamento, golpes pela bancada e os seis cenários estruturais do time mais um de tipologias.

### Patch Changes

- aa2bc27: The structure spec the house registers in the destruction world keeps what the pieces carry: the water tank holds its 500 L (so a hole leaks) and the gas cylinder explodes; the thin wall (`thickness`, `fill`) and the tags of each come along, so a 9 mm round goes through the tank.
- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-floorplan-structure@1.0.4
