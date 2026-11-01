# @adatechnology/game-destruction-three

## 0.12.0

### Minor Changes

- b818f6a: A box on the edge of a table rests or falls as it should, and a round through a cardboard box punches holes instead of throwing it. Loose pieces take the side of a step of the ground (the edge of a table, a counter) as a wall: a corner that comes at a higher top from the side stops there instead of being lifted onto the top every frame, which made a box shot near the edge hop on it without end. Over a step the points along the box's edges touch too, so the table's edge under a box is a support between its corners (a box with 2 cm over the edge and its centre of mass on the table stays), and the contacts are solved together, warm started from the last substep. A hollow shell of a material that tears (a printed carton, `shapeDestruction('box')` of game-items-three) is holed by a round that goes through it, not shredded. The test room no longer sends a spawned item with no mesh to minus infinity. The points along the edges stand only on the fixed ground (things spawned together no longer ratchet up onto each other), and what the contacts' friction takes from a piece is taken from that substep's move too, so a push the floor's grip holds no longer creeps a sofa along.

  A part can hold loose dry contents (`PartSpec.powder`, `{ color }`; `userData.destructionPowder` for `specFromObject3D`; the `powder` of an item of game-items-goods, written on its shell by `tagForDestruction`): the `hole` event carries it and the renderer puffs it out of the entry and, more, out of the exit. The cereal box, flour, sugar, salt, coffee and rice of the catalogue have theirs.

- f911ab1: How long debris stays on screen is configurable per fragment: `fragmentLife` takes a rule `(fragment, objectId) => seconds` besides a number (0 = forever), so rubble can stay and chips can go by material, size or object. The test room takes `debris: { fragmentLife, maxFragments, particles }`, where `particles` tunes the dust, smoke and chip sprites by kind.
- 5d5e869: `onLoosened` is also called when furniture came apart and the renderer made what stayed a piece, with a new `cause` argument (`blast` or `apart`). The test room stops keeping the footprint of a table knocked over that way, so no invisible wall stays where it stood.
- 7051d83: Opening doors by hand: a tap of E on a door, lid or drawer of furniture or a vehicle (any part an `open_*` clip moves) opens or closes it. The player steps up to the handle, the hand takes the free edge and follows it in first and third person, the leaf swings at a speed set by its mass and stops at what is in its way, a door that swings into the player makes the player step back, and a locked leaf only rattles (`createDoorUse` in game-player, `room.useLeaf`/`lockLeaf`). New sounds for the latch, the hinge, the leaf meeting the frame and the rattle. House doors use the same hand and body through the new `ModuleHost.reachFor`.
- 53babb5: A scenario of the test room does the same whatever ran before it: the reset before each scenario puts every random stream, seed counter and clock back to its start.

  - `game-destruction-three`: `DestructionRenderer.reset()` (`clear` plus the renderer's random stream, the one that scatters the shove points of a blast, the fragments' stream and the clocks back to their seed and 0). Before, a blast after other scenarios pushed the loose items from other points, and the grenade's camp table could end up moving towards the blast.
  - `game-contracts`: `ModuleHost.onReset`, for a module to put its own streams, seed counters and clocks back when the host returns to its seeded start.
  - `game-test-room`: the reset before each scenario calls `renderer.reset()` and the modules' `onReset`.
  - `game-characters-three`: the test module's random stream, body seeds and animation clock start again on `onReset`.
  - `game-terrain`: clearing the marks starts their numbering again.

### Patch Changes

- 385281b: Fragments (splinters, lumps, shards, a brick out of a wall) are named `fragment` and marked with the kit origin of `game-destruction-three`, so the scene audit no longer reports debris as a piece drawn outside the kit.
- 6ef4843: Pieces on the floor come to rest instead of trembling forever: separation no longer moves or wakes a sleeping piece, and a piece that keeps to the same spot (within 1 cm and 3°) for 1.5 s sleeps however its speed flickers, as a book propped on another does.
- 4eb330f: A shot breaks a brick or a concrete block where it lands instead of knocking the whole unit out: a crater a few centimetres across goes through the unit (about 6 cm for a pistol round, 10 for a rifle round), the rest of the unit stays, and small bits of the inside of the material fly out of both faces, most out of the far one. The rest of a unit comes out, in pieces, only once its craters took most of it. A wall, a partition or a column now loses its section across one height, so a slot shot along the base of a wall brings it down while the same rounds spread over its face leave it standing. The house renderer draws each crater as an irregular hole through the unit with the plaster broken off around it, and the marks of a shot (bullet holes, spalls) now sit on the face as drawn, not a few millimetres behind it.

  A pistol round on a plastered brick wall no longer draws a star of cracks and a flat orange disc: the plaster comes off in a ragged patch drawn by the house renderer, with the brick and its mortar under it and the bullet hole on the brick (the destruction renderer leaves its patch out on meshes marked `userData.drawnSpalls`). The destruction renderer also keeps ranges another drawing collapsed (`userData.collapsedRanges`) when it rewrites a merged mesh, so a broken wall comes back after a reset.

  The other materials take a round the same way: the concrete laid bare in a wall is one face with no joints, an opaque brittle body (a ceramic tub) cracks a hand around the hit in a dark shade of its own colour instead of black lines across the piece (glass keeps its long white cracks), and a hole in wood has a rim of torn fresh wood under it.

- A piece that is falling over is not put to sleep for keeping its place, and whether it already lies is measured on its own box: a lone leg whose top touched the board it was joined to stayed standing.
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
  - @adatechnology/game-audio@0.3.5
  - @adatechnology/game-vfx-three@0.3.6

## 0.11.1

### Patch Changes

- 73f3cf2: Crushed masonry takes the colour of its material: brick, concrete, plaster and stone get `visual.innerColor`, the `debris` event names the material of
  the bits when it is not the part's own (`material`, the plaster coat over a brick wall), and the renderer throws chips and dust and draws spalls in that
  colour (brick orange, plaster light, concrete grey) instead of the dark grey of the generic concrete impact.
- 2a1bb17: Wall damage stays where the shot lands. The house no longer redraws a whole wall as plain white blocks on the first brick that comes out: the wall keeps
  its geometry, plaster and paint, and is cut by a mask only where units came out, with a ragged edge of plaster and the bricks (in their mortar) or the
  rough concrete of a beam showing around the hole. Bullet holes, spalls and the impact marks of the effects go with the brick that comes out
  (`DecalPool.clearInside` in game-vfx). A bullet now wears only its stretch of a joint (`BULLET_JOINT_SPAN`), so a row of shots along a ten-metre wall no
  longer opens the whole mortar bed and brings the wall down.
- Updated dependencies [73f3cf2]
- Updated dependencies [2a1bb17]
  - @adatechnology/game-contracts@0.19.0
  - @adatechnology/game-destruction@0.12.0
  - @adatechnology/game-vfx@0.5.0
  - @adatechnology/game-audio@0.3.4
  - @adatechnology/game-vfx-three@0.3.5

## 0.11.0

### Minor Changes

- f68acce: Cans dent where they are hit and are holed on the lid, the bottom and the rim as on the side. An item family can give its shell the real wall thickness (`rule.wall`: a drink can is 0.1 mm on the body and 0.25 mm on the ends, a food tin a bit more); `tagForDestruction` writes it as `userData.destructionThickness` and `specFromObject3D` uses it for the part, so a 9 mm goes through a lid even at a slant. With `tessellate.cylinder.capRings` (and `three` passed to `tagForDestruction`, as `buildItem` does) each cylinder of the model becomes one lathe with rings on its ends and rows as fine as its columns, and a model drawn as a lathe gets the same columns, so the lid and the bottom have vertices to dent. In the world a ductile sheet 0.5 mm thin or less folds deeper than a plate for the same blow (up to 4 times), on a patch no wider than 2.5 cm and never past near its middle, and the slit a blade cuts in it is pushed in around. A skin follows its shell past the degenerate triangles of a lathe. The liquid of an opaque container is not drawn through a narrow mouth (a can's tab) nor through the bullet holes drawn on it.

  The test room pushes what a round hits at the point of the drawn surface it meets, along that surface's inward normal (plus a share along it), with the momentum the round lost there: all of it when it stopped, through a thin shell only what the wall and the liquid inside took. A round on the right of a can pushes it away and to the left and spins it; before, it got the whole momentum of the round along the shot at the box the world sees.

- 2961d53: Deformable ground: new `game-terrain` and `game-terrain-three` (height field with strata per column, digging by material and blow, marks under a budget, clods, fire). The test room's floor is now a terrain, and each area lays its own ground through `TestableModule.ground`. The room's `craters` option is gone: the floor always digs. Adds the catalogue materials `asphalt`, `sand`, `gravel`, `turf` and `mortar`.
- e5ac121: Pushing furniture: holding the interaction button against a piece fills a ring by its mass, then the player walks with it, slower with the load; `world.sweepBox` tests the volume of the piece before each step, an obstacle or too much mass locks it and the player strains; poses in first and third person, and a drag sound by material.
- 31fc87d: Each material answers each kind of blow its own way. New `MaterialDef.hits` (material × damage type): what a blow tears out where it lands (`tear`: `splinters`, `lumps`, `none`) and the joules per piece. A round into wood tears splinters of fresh wood out of the exit (and back out of the entry), MDF crumbles lumps, plywood splinters; a punch crumbles MDF, a kick splinters pine, hardwood and steel tear nothing. Snapping boards (MDF, plastic) also break where they are shot. `innerColor` for wood, plywood and MDF. Cases with shelves (`furnitureSpec`) are MDF.

  Loose pieces land on what is under them: on other pieces and on the drawn meshes of fixed objects (`PieceSystemOptions.staticTopAt`), so a falling shelf rests on the books below and a tipping panel on the chair in front. New `DestructionRenderer.solidsNear` gives the drawn boxes around a point. The test room's player walks by them: steps onto low debris (up to 45 cm), stops at taller things and kicks light pieces (books, boards) out of the way, instead of the scenery's old footprints.

- 31fc87d: A solid wooden top (`furnitureSpec`: 3.5 to 7 cm thick and at least 50 cm wide) is boards glued edge to edge: it breaks board by board at the point hit, in stubs and splinters, instead of falling whole. `top` gains `parts` with every board. Part ids of those tops change: `wood_0` becomes `wood_0_b0`, `wood_0_b1`...

  `DestructionRenderer.solidsNear` follows what is drawn: a turned mesh gives several boxes along its length instead of one axis box of mostly air, and big fragments (half a board) are solids with a `loose` body. They stay where they lie instead of shrinking away and are the last to go over the fragment limit.

  The test room rests loose things on the board under them (`SceneryObject.top.parts`), and its player steps on or kicks big fragments.

  Furniture that comes apart no longer leaves anything fixed: what stayed standing becomes a piece too, and a piece whose feet are too close for its height (a lone leg, a board on two legs in a line) falls over until it lies.

- 1821647: Nothing stays hanging when the ground changes: `Terrain.onDeform` says where it changed, `DestructionRenderer.wakeRegion` wakes what slept there, thrown pieces at rest fall again. The ground goes on beyond the terrain, so what is thrown past the edge lands on something.

### Patch Changes

- eaedd22: Physics of the objects in the room (first object audited: the trash bin). The player no longer walks through spawned objects: what stands taller than a step blocks the walk, and the walk pushes what is light enough with the force of a person against the floor's grip (a 3 kg bin slides or tips, a 70 kg fridge only blocks); the walk moves in short steps so a long step cannot jump over a thin obstacle. A kick leaves the hip instead of the eye, so it reaches what is in front of the feet. A round through a ductile shell (plastic, sheet metal) leaves in it only the energy it took to cross it (two holes, the part does not burst); a blade with more energy than a thin wall takes goes through it (a knife into a plastic bin or a can). A burst of fragments over the live budget no longer builds the excess meshes only to fade them.
- Updated dependencies [f68acce]
- Updated dependencies [2c9c963]
- Updated dependencies [2961d53]
- Updated dependencies [e5ac121]
- Updated dependencies [31fc87d]
- Updated dependencies [eaedd22]
- Updated dependencies [3aec7f3]
  - @adatechnology/game-destruction@0.11.0
  - @adatechnology/game-contracts@0.18.0
  - @adatechnology/game-audio@0.3.3
  - @adatechnology/game-vfx-three@0.3.4
  - @adatechnology/game-vfx@0.4.4

## 0.10.0

### Minor Changes

- da5261d: A shot bookcase comes apart like one. A long wooden part (a board, a batten, a beam) breaks where it is hit: its length is cut in 10 cm bands with their share of its hit points, and the band that runs out breaks it across there, a stub each side and splinters between; a thin board goes in a few shots, a beam or a log takes many. New `structure.maxSpan`: a part whose remaining supports leave it a longer span falls with what rests on it. `furnitureSpec` stands shelves and racks as a carcass (the sides carry, each shelf needs both ends, the back carries nothing), so a broken side drops its shelves and their books. The test room's scenery takes `free`: shots whose push moves its mass (a shotgun, not a pistol) shove it. A light collapse of furniture raises a puff of dust instead of a storey's cloud.
- 2a371c7: Walls of units come apart under fire. A shot or a blow on a wall made of units (`PartSpec.units`: bricks, blocks) wears the unit it lands on and a little the ones around it; a unit that took `breach.chipEnergy` joules per kilogram (default 200: two 9 mm rounds in the same brick, one rifle round) comes out as a fragment (new `chip` event, `PartState.chipped`), shots and rays pass through the gap, and enough units out close together open the wall (stage 2) as before. The destruction renderer throws the unit with its dust; the house renderer redraws the wall as its courses without the units that came out (and now places the opening of a breach in the house's own space). `wallPiece` keeps the detail of the houses' walls (plaster, bricks, breach) and gains `follow`, and the test room's scenery takes `follow` so its target wall shows the gaps.

### Patch Changes

- Updated dependencies [da5261d]
- Updated dependencies [50d8074]
- Updated dependencies [2a371c7]
  - @adatechnology/game-contracts@0.17.0
  - @adatechnology/game-destruction@0.10.0
  - @adatechnology/game-audio@0.3.2
  - @adatechnology/game-vfx@0.4.3
  - @adatechnology/game-vfx-three@0.3.3

## 0.9.0

### Minor Changes

- bf68a04: A shot book tears into loose pages instead of slabs as thick as the book. New `MaterialDef.sheet` (thickness of one sheet; paper 1 mm): a `tear` part thicker than a few sheets comes apart as layers of thin scraps, a little askew, three in four marked `Fragment.inner` (pages) and the rest cover. New `visual.innerColor` (paper: cream) colours the inner scraps and the fibres a hit throws out. The renderer lets those thin scraps glide and flutter down before they settle flat.

### Patch Changes

- Updated dependencies [bf68a04]
  - @adatechnology/game-contracts@0.16.0
  - @adatechnology/game-destruction@0.9.0
  - @adatechnology/game-audio@0.3.1
  - @adatechnology/game-vfx@0.4.2
  - @adatechnology/game-vfx-three@0.3.2

## 0.8.2

### Patch Changes

- Updated dependencies [df42f4b]
- Updated dependencies [df42f4b]
  - @adatechnology/game-audio@0.3.0
  - @adatechnology/game-contracts@0.15.0
  - @adatechnology/game-vfx-three@0.3.1
  - @adatechnology/game-destruction@0.8.2
  - @adatechnology/game-vfx@0.4.1

## 0.8.1

### Patch Changes

- 692c098: Test room: C crouches (`crouch.keys` option) without also firing the held item's second use, Ctrl/Alt+key stay in the game while playing, closing the page asks first, and a "Full screen" button keeps the whole keyboard (Ctrl+W included). Player avatar: crouch pose and arm carrying angle. Destruction: leaks follow the moved object and hole decals sit on dented skins.
- Updated dependencies [692c098]
  - @adatechnology/game-destruction@0.8.1

## 0.8.0

### Minor Changes

- 8feb42f: An explosion shoves what is around it. `blastShove` (game-contracts) is the one rule, `min(maxSpeed, sqrt(2 * energy * coupling / mass)) * (1 - d / r)^2`, with every number in `BlastShoveOptions` (the room's `blastShove` option, lent to modules as `ModuleHost.blastShove`). The destruction renderer uses it for its pieces and, with `shoveable`/`onLoosened`, makes a heavy object that is not fixed a piece when a blast reaches it. The test room marks heavy, free items that way, and wraps an item whose builder scales the root so that its spec, box and mass are in metres (a can of beans was 0.7 m and 460 kg). The characters test area pushes its people and knocks them down. The explosives area has scenarios that measure the push of a P13 shot and a thrown M67.
- 642f290: `buildItem` takes `destructible: true`: each mesh gets the `game-destruction` material of its kit tag (`DESTRUCTION_MATERIAL_BY_TAG`), and models listed in `data/destruction.json` (the three cans) are hollow shells welded to one another with their label as a skin. The items test area draws its items that way. `specFromObject3D` understands `userData.destructionSkin` (such a mesh stays on the part it overlaps and never becomes a part of its own) and `root.userData.destructionMass` (the real weight, split between the parts); `buildItem` passes the item's `weight` that way.
- 8dc6775: Loose pieces and debris can be picked. Every mesh of a part now carries `userData.destructionPart` (part id) and `userData.destructionObject` (id of the world object it belongs to), including the meshes of a piece made by a collapse or detach and the mesh a vertex-range part gets when it leaves a merged mesh (they used to lose it). Fracture fragments, decals and ground stains carry `userData.destructionDebris = true` so a host can skip them in a raycast.
- bcf60c8: `specFromObject3D` reads `userData.destructionContains` (`{ fluid, liters }`) of a mesh onto the part it makes, so that part is a container: a hole through it emits a `leak`.
- d24de8a: Soil and foundations (T10 §8). `game-contracts`: `DestructibleSpec.soil` (`SoilProfile`, `SoilLayer`), `PartSpec.structure.pile` (`PileSpec`),
  `ObjectState.soil` (`SoilState`) and the `settle` event. `game-destruction`: soil classes with the NBR 6122 basic pressures (`SOILS`), footings as
  elastic-plastic springs (subgrade modulus of a rigid footing, safety 3), piles by Décourt-Quaresma (`pileCapacity`, `pileLength`), and the object as a
  rigid body on them with the 1/200 out-of-plumb and P-delta: it settles, a heavy building on soft soil sinks, leans and tips over, on piles to firm
  ground it holds; `buildFrame({ footing, raft, piles, soil })`; option `soil` (`SOIL_DEFAULTS`). Off unless a spec has `soil`. `game-destruction-three`:
  draws the settlement and tilt under a `destruction-soil` node. `game-floorplan-structure`: `toDestructibleSpec({ soil, foundation, piles, soils })`
  puts the house on a raft (with piles) or on footings under each wall (`RAFT_THICKNESS`, `PILE_AREA`).
- b3f1cf1: The first shot, hit or leak no longer stalls the frame: the renderers build the shader programs they would make on demand (`warmUpProbes()` of the destruction, effects and fluids renderers returns meshes of those materials, `WarmUpProbes` in the contracts) and the test room renders them once, again whenever the lights of the scene change (a program is keyed by the light counts, and a material that does not use lights keeps the program of the lights it was first drawn with). `TestRoom.warmUp()` does it on demand. Measured in the items test area with a pistol on a soda can: the first frames after the shot went from 201 and 106 ms with 3 new programs to 15 and 8 ms with none.

### Patch Changes

- 3ebc4d5: A dent is never silently invisible: when fewer than 3 vertices of a mesh fall inside the dent radius (a mesh coarser than the dent), `applyDent` widens the radius to 1.5 times the distance to the nearest vertex, so the nearest vertices are pushed in.
- 31e7483: A skin mesh (`userData.destructionSkin`: a label, a coat) now moves with the surface of the shell under it when the part is dented (nearest shell triangle, barycentric weights, `applyPartDent`), instead of being dented on its own grid, so the two meshes never cross whatever their vertex grids are.

  The dent of a part also uses one reach for all its meshes: `Visuals.dentReach` finds the radius that gives each mesh at least 10 vertices (and 1.5 times the distance to the nearest), the part takes the widest.

- 7b5efe4: `specFromObject3D` (and the renderer's part matching and piece measuring) now work in metres for a scaled root: the root's world scale is kept, only its position and rotation are removed. A model drawn in other units and shrunk with `root.scale` no longer gets an oversized destruction body.
- 5b1d53f: `DestructionWorld.vent(objectId, partId, { point?, normal?, diameter? })` opens a through opening in a container part like a valve does (a `leak` event, the level drops, no damage and no `hole` event; `Hole.vent` marks it) and `seal` closes it. A `heat` hit of 470 °C or more on a part that leaks flammable fluid lights the leak (a lighter or a torch held at a gas jet): it burns, or goes off by its `explodes.chain`. The renderer ends a leak when its opening is closed.
- Updated dependencies [1331018]
- Updated dependencies [8feb42f]
- Updated dependencies [ef44e99]
- Updated dependencies [5b1d53f]
- Updated dependencies [b861fca]
- Updated dependencies [6889db1]
- Updated dependencies [5679830]
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
- Updated dependencies [d032102]
- Updated dependencies [0e27281]
- Updated dependencies [dbe8de3]
- Updated dependencies [b3f1cf1]
- Updated dependencies [011e17a]
  - @adatechnology/game-contracts@0.14.0
  - @adatechnology/game-destruction@0.8.0
  - @adatechnology/game-vfx@0.4.0
  - @adatechnology/game-vfx-three@0.3.0
  - @adatechnology/game-audio@0.2.1

## 0.7.3

### Patch Changes

- Updated dependencies [0aafb73]
  - @adatechnology/game-vfx@0.3.0
  - @adatechnology/game-vfx-three@0.2.1

## 0.7.2

### Patch Changes

- a41fcb7: The voices and the animal calls on `game-audio` (T6.1g). `game-characters-three` gets the sound bank of the bodies, 16 recipes whose traces equal the team code (the game's `grito` and `voz`, the art scene's `voice` behind groan, scream and leap, plus inhale, grab, bite, hurt, flesh, sever and gore), the table of the voices of the 13 undead types (`UNDEAD_VOICES`) and `createCharacterSound(host.audio)` (voices by moment, `body` events, what the player hears, the screamer's wind-up). `game-animals-three` gets the four calls of the game's `bichoSom` and `createAnimalSound` with the page's cooldowns. Both test areas play on the room's engine (new actions `voice`, `special_call` and `call`). `game-audio` exports the art scene's primitives (`sceneNoise`, `sceneTone`, `sceneVoice`, `sceneRecipe`); `game-destruction-three` uses them instead of its own copy (same recipes).
- Updated dependencies [a41fcb7]
- Updated dependencies [485acc7]
- Updated dependencies [d15e990]
- Updated dependencies [f49e466]
  - @adatechnology/game-audio@0.2.0
  - @adatechnology/game-vfx@0.2.0
  - @adatechnology/game-vfx-three@0.2.0
  - @adatechnology/game-contracts@0.13.0
  - @adatechnology/game-destruction@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [98ae206]
  - @adatechnology/game-contracts@0.12.0
  - @adatechnology/game-audio@0.1.2
  - @adatechnology/game-destruction@0.7.1
  - @adatechnology/game-vfx@0.1.3
  - @adatechnology/game-vfx-three@0.1.3

## 0.7.0

### Minor Changes

- 968d7df: `renderer.explode(point, energy, radius, { report })` pushes each piece with the energy that reached its object (shelter and confinement of the `world.explode` results); without a report the old formula.

### Patch Changes

- Updated dependencies [968d7df]
- Updated dependencies [968d7df]
  - @adatechnology/game-contracts@0.11.0
  - @adatechnology/game-destruction@0.7.0
  - @adatechnology/game-audio@0.1.1
  - @adatechnology/game-vfx@0.1.2
  - @adatechnology/game-vfx-three@0.1.2

## 0.6.0

### Minor Changes

- 0f9e616: `createDestructionSound(engine)` registers the material sounds of the art scene (`glass`, `wood`, `thunk`, `ping`, `clang`, `chip`, `crumble`, `thud`, `hiss`, `boom`, `burst`, `crack`) and the game's `explosion_boom` in `@adatechnology/game-audio`, and maps the renderer's `onSound` keys through a replaceable table (`art_scene` or `game` style). The renderer sends `burn_end` when a part goes out or finishes burning, and `burn_loop` is the fire loop that rises with the parts in flames. `game-audio` is a dependency.

### Patch Changes

- Updated dependencies [7fd46fb]
- Updated dependencies [0f9e616]
- Updated dependencies [3a8cc95]
  - @adatechnology/game-contracts@0.10.0
  - @adatechnology/game-audio@0.1.0
  - @adatechnology/game-destruction@0.6.1
  - @adatechnology/game-vfx@0.1.1
  - @adatechnology/game-vfx-three@0.1.1

## 0.5.0

### Minor Changes

- aa2c014: `game-destruction-three` draws blasts and fires with the effects world (T5.1f). A new `RendererOptions.vfx` takes the world the host shares (stepped by the host's `VfxRenderer`); without it the renderer makes its own world and `game-vfx-three` layer and steps them in `update`, so existing callers keep working. An `explode` event plays `ev.effect ?? 'generic'` (the M67 scaled by `radius / 15`; an id the catalogue does not know falls back to it), the five old bursts and the point light are gone, and a burning part gets one `vfx.fire` that follows it and stops when the part stops burning. `explode(point, energy, radius, options?)` takes `{ effect, direction, visual }`; `visual: false` keeps only the shove and the sound. `RendererOptions.explosionLight` is removed (the light belongs to the effects world) and `RendererOptions.camera` is new. Debris, sparks, ash, steam, drips and leaks go through the shared sprite pool (see `t5-1fg-sprite-pool`).

  `game-destruction` gets `blastFrontSpeed` (default off): glass an explosion reaches breaks `distance / speed` seconds later, in `update`. The `explode` event now carries `effect` from `explodes.effect`.

  `game-vfx-three` names its puff, spark and glow meshes (`vfx-puffs`, `vfx-sparks`, `vfx-glows`) and draws blank mark textures when there is no DOM, so it runs headless.

- 6aa11f1: One sprite pool for the whole kit (T5.1f-g, spec 001). `game-vfx` gets `vfx.burst(kind, point, normal, count, speed?, options?)`, `vfx.spawn(...)`, `vfx.onLand(owner, fn)` and `vfx.sprites()` over 14 kinds (`data/sprite-kinds.json`, `patchSpriteKinds`; the numbers and the generator are the ones of the old `particles.ts`), with `floor` and `rise` spawn options; `game-vfx-three` draws them in two layers (`vfx-sprites-additive`, `vfx-sprites`). `game-destruction-three` and `game-fluids-three` delete their own `particles.ts` and use the pool (`ParticleKind` stays as an alias of `SpriteKind`; `FluidRendererOptions` gets `vfx` and `camera`; the destruction renderer plays the effects of the Phase 2 events through `eventEffects`, default `EVENT_EFFECTS_MAP`). `game-weapons-three` plays the muzzle flash and the casing of a shot seen from outside through `host.effects` (`muzzle_glock|ak|r870|barrett`, `casing_brass|shell|50`, by case type, in `data/world-effects.json`); the `shot` host event of `game-contracts` carries optional `origin` and `direction`, and the effect sink falls back from explosions to the Workshop recipes (`param` by index or id).

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
  - @adatechnology/game-contracts@0.9.0
  - @adatechnology/game-vfx@0.1.0
  - @adatechnology/game-vfx-three@0.1.0
  - @adatechnology/game-destruction@0.6.0

## 0.4.0

### Minor Changes

- 86179cc: Desenha os eventos de parede: `spall` (remendo da cor do núcleo), `stage` 2 (fragmentos do tamanho da peça com os furos de `Fragment.marks` presos neles, a peça continua desenhada) e `expose` (vergalhão em cilindros instanciados, `renderer.rebarCount()`). A abertura cortada na malha fica para o renderizador de casas.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
- Updated dependencies [95c4bdd]
  - @adatechnology/game-contracts@0.8.0
  - @adatechnology/game-destruction@0.5.0

## 0.3.3

### Patch Changes

- Updated dependencies [572f2fa]
  - @adatechnology/game-contracts@0.7.0
  - @adatechnology/game-destruction@0.4.2

## 0.3.2

### Patch Changes

- Updated dependencies [bd41a66]
- Updated dependencies [16c1453]
  - @adatechnology/game-contracts@0.6.0
  - @adatechnology/game-destruction@0.4.1

## 0.3.1

### Patch Changes

- 76ae86f: Chain reaction of explosives (A11). A part with `explodes.chain` is set off by a bullet, fire or a blast within reach and explodes after the delay of that trigger (fixed or drawn from the seed); the world emits `primed` and then `explode`, a part goes off once, blasts resolve in order of time and the delays count from the blast that armed the part, so the timeline does not depend on the `dt` of `update`. `explosivePart(explosive, part)` builds the part from an `ExplosiveDef` of `game-weapons` (fuel barrel, car tank, propane, pump, station tank). A bullet or a blast that would have destroyed such a part now arms it instead. `game-destruction-three` draws the fire of a part primed by a shot or fire.
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
  - @adatechnology/game-destruction@0.4.0
  - @adatechnology/game-contracts@0.5.0

## 0.3.0

### Minor Changes

- 1920f22: `DestructionRenderer.explode(point, energy, radius)` draws a blast that has no exploding part (flash, fire, smoke, light, sound and a shove on pieces in range). `world.explode` emits no event, so a grenade used to leave only debris; the test room now calls the new method when a thrown explosive detonates.

  `explode` is a new **required** member of the `DestructionRenderer` interface: any implementer of the interface (a custom renderer, a test double) must add it.

### Patch Changes

- Updated dependencies [71fb367]
  - @adatechnology/game-contracts@0.4.0
  - @adatechnology/game-destruction@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [6022fe5]
  - @adatechnology/game-contracts@0.3.0
  - @adatechnology/game-destruction@0.3.1

## 0.2.0

### Minor Changes

- 4573613: `bind` can now draw a part by a vertex range of a merged mesh: `BindOptions.parts` values also accept `{ mesh, range: [v0, v1] }` (new exported type `MeshRange`, alone or in an array with plain meshes). Dents, char and heat colours (through vertex colours), melt and hole/crack decals apply only to that range. When the part detaches, collapses (the renderer now also splits loose groups on `collapse` events) or breaks, its faces are extracted into a new mesh for the loose piece and the range is collapsed in the merged mesh; `restore` and `clear` bring everything back. Invalid ranges throw from `bind`.

### Patch Changes

- Updated dependencies [4babeca]
- Updated dependencies [463c9cc]
- Updated dependencies [5603151]
- Updated dependencies [d913ace]
  - @adatechnology/game-contracts@0.2.0
  - @adatechnology/game-destruction@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [cbcbd82]
  - @adatechnology/game-destruction@0.2.0

## 0.1.1

### Patch Changes

- cb132c2: `userData.destructionPart` may be a string or an object `{ id, material?, parent?, kind? }` in `specFromObject3D` and `bind`; `parent` + `kind` add an explicit joint.
- 308a258: Tall thin pieces (a door off a fridge) now topple instead of balancing on an edge: a narrow support gets a topple push and the piece does not sleep until it rests on a stable support.
- 2363a12: Fragments and debris of vertex-coloured meshes use the average vertex colour (cached per mesh) times `material.color` instead of coming out white.
- Updated dependencies [930b9ab]
- Updated dependencies [745e342]
- Updated dependencies [cc23a66]
- Updated dependencies [d727a0c]
- Updated dependencies [f1e3349]
- Updated dependencies [fd82f4a]
- Updated dependencies [632a45a]
  - @adatechnology/game-contracts@0.1.1
  - @adatechnology/game-destruction@0.1.1

## 0.1.0

### Minor Changes

- 1691ef2: New package `@adatechnology/game-contracts` (global `GameContracts`, no runtime dependencies): the destruction contract (`DestructibleImpl`, `IMPACT_CONTRACT`, `checkDestructible`, `checkHit`, hits, events, state), weapons (`Shot`, `Use`, `shotToHit`), fluids (`ContainerSpec`, `LiquidId`, `ItemUseDef`), item animations (`AnimationClipSpec`, `checkAnimation`) and the `TestableModule` a module hands the test room. The destruction, destruction-three, weapons, fluids and test-room packages depend on it and re-export the moved types, so existing imports keep working; their IIFE bundles now include the contracts. `game-test-room` gains `room.loadModule(module)` (items under the module group, scenarios as buttons, contract checks written to the log), `room.playAnimation` / `room.animations()` with an animations panel, and `TestRoomItem.impl` / `animations`. `game-destruction`: collapse events are computed after all losses (never for a broken part), brittle thin parts break from drops (`fragility`), and `checkDestructible` takes its material ids from the built-in table. `game-destruction-three`: `hardLanding` syncs the transform before the hit and `Piece.localCenter`. `game-fluids`: tap API (`addTap`, `setTap`, `removeTap`, `taps`, `tap` event).
- 0256a5b: Initial release (0.1.0): three.js renderer for `@adatechnology/game-destruction` with vertex dents, hole and crack decals, char and heat glow, melting and puddles, fragments, loose pieces with light physics and pooled particles, plus `specFromObject3D` and `heatColor`.

### Patch Changes

- Updated dependencies [1691ef2]
- Updated dependencies [5feff74]
  - @adatechnology/game-contracts@0.1.0
  - @adatechnology/game-destruction@0.1.0
