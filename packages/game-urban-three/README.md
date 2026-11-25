# @adatechnology/game-urban-three

Draws the scenes of `@adatechnology/game-urban` with three.js, the way the team's Galeria do Vale Cinzento does.

```ts
import * as THREE from 'three'
import { createUrban } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'

const urban = createUrban()
const b = urban.builder({ seed: 7 })
urban.streets.grid(b, { block: 36, count: 2, width: 10 })
urban.poles.get('led_double').build(b, { x: 18, z: 5 })

const three = createUrbanThree(THREE, { document })   // `document` only for signs and labels
const drawn = three.draw(b.scene())
scene.add(drawn.root)
// each frame: drawn.animate(elapsedSeconds)            // flickering lamps, sweeping searchlights
// when done:  drawn.dispose()
```

- Each part becomes a mesh in the order it was added: boxes with the team's rounded edge (a 4x4x4 grid per face, edge vertices on an arc), tapered cylinders, flat-shaded cones and prisms, planes that only receive shadows, crowns that only cast, canvas signs and labels.
- The small boxes (road dashes, sandbags) are one instanced mesh, and the windows two (lit ones glow, dark ones are a dark pane). The instance matrices are the page's.
- Lights are real `PointLight` and `SpotLight` objects; `drawn.lights` lists them. `animate(t)` flickers the failing lamps (`I * (sin(23t + x) > 0.3 || sin(3.1t) > 0.85 ? 0.15 : 1)`) and moves each searchlight target around its tower.
- `physicalLights: true` (with `lights`, off by default): each lamp's source gets `physicalIntensityOf(part)` and each searchlight's `physicalIntensityOf(part, beam)`. The team's numbers were tuned on r128 without physically correct lights (no inverse square), so under r155+ they light almost nothing; the factor makes the ground at the foot of the lamp (or where the beam lands) as bright as on the page. Without the option the sources keep the page's numbers; the path without `lights` never changes them.
- `flickerLenses: true` (off by default): a failing lamp of `game-urban` (its lens and its light carry a `flickerPhase`) blinks its head with its light. The phase is rounded to one of `LAMP_FLICKER.groups` (4) groups, each with one lens material per colour, and both follow `flickerLevel(t, groupPhase)`, so a lamp that got no real light still blinks; at most 4 more materials per colour. Without the option the lens stays lit and the light keeps the page formula above, on both paths. `t` is the time the host passes to `animate` (presentation only).
- A `terrain` part becomes the square mesh with vertex colours (flat shaded, roughness 1, casts and receives shadows); the water is a plane part drawn after it.
- A `placement` part (a vehicle of the fleet, a species of the pack) becomes a group at the spot, turned and scaled, holding the object a resolver made: `createUrbanThree(THREE, { resolvers: { vehicle: createVehicleResolver(vehiclesThree), plant: createPlantResolver(THREE) } })`. The vehicle resolver uses the `lite` build of `game-vehicles-three` (six fused meshes) and the plant resolver `generate` and `createPlantObject` of `game-vegetation`; each is built once for an id and paint (or seed) and cloned for every spot, sharing geometry and materials. An id the package does not know leaves the spot empty. `resolver.dispose()` frees them.
- `draw(scene, { root })` draws into a group of yours. Works on three r160 and later.

## Utility networks

`drawNetworks(networks, options)` draws the aerial networks of `@adatechnology/game-urban/networks` (`generateNetworks`):

```ts
const drawn = createUrbanThree(THREE, { lights, physicalLights: true, flickerLenses: true })
  .drawNetworks(generated.networks, { isNight, lamps: { lit: 0.8, flicker: 0.15 }, surfaceAt: generated.surfaceAt, poles: urban.poles })
scene.add(drawn.root)
// each frame: drawn.animate(t); when the camera moved: drawn.setFocus(x, z)
```


`drawNetworkSurface(networks, { surfaceAt })` draws what shows of the buried networks (`surfacePiecesOf`): PV and gallery box covers flush with the road
(2 mm over the frame, 2 mm over the lid), the inlets' grates, cleanout and valve covers, hydrants, the outfalls' wing walls, and at each lot the inspection
cover, the meter box and the downspout's mouth, in two instanced draw calls. `remove(id)` takes a piece off the ground (a cover thrown by a blast).
`drawBuriedNetworks(networks, { surfaceAt })` draws the pipes (two instanced halves each, so `sever(id, share)` can break one) and the pits under the covers
at their depths, in three draw calls: the terrain hides them and a crater deeper than their cover shows them.

- Each `concrete_distribution` pole (or any registry pole with `slots`) stands at its node, turned with its arm toward its lamp: the mast
  instanced per spec, the hardware of `distributionHardwareOf` (crossarm and pin insulators where it carries medium voltage, the low-voltage
  clamp, one telecom clamp per cable, the arm and luminaire, the transformer's bracket and bushings) one instanced mesh of boxes, the
  transformer tanks and reserve coils one instanced mesh of cylinders, the lenses one more.
- The conductors hang from the pole's slots with the sag the generator laid them with (`y − 4·sag·t·(1 − t)`, 8 stretches): three bare
  medium-voltage phases, one multiplexed low-voltage cable, the telecom bundle (a cable per clamp), the drops (power from the low-voltage clamp,
  telecom from the top cable) to each lot's anchor, and a guy against each pull of a corner or end pole, anchored on the sidewalk (`surfaceAt`).
  Each class is one merged tube mesh; `spans` maps every edge to its index range there and in the far lines (R8).
- Level of detail: `setFocus(x, z)` keeps the spans within `nearDistance` (90 m) as tubes and draws the others as one `LineSegments`, by
  rewriting each index buffer once when a span changes side. About ten draw calls near for a whole district, one far.
- The lamps are the network's `light` nodes with `networkLampsOf` (the `lampStateOf` of #470 by the seed and the node's place); a lit one is a
  source of the host's light budget, a failing one blinks its lens and its light on its flicker group.
- `dispose()` removes the sources and frees every geometry and material it made.

The scene hash, the lists of instances and the surface of each material (shadows, roughness, metalness, flat shading) of 34 cases are tested against the page.

## Geometry

Planes, cylinders, cones, boxes (and the rounded box built on one), the prism's extrusion and the test area's light reach spheres are made
through `shapeGeometries(THREE)` of `@adatechnology/game-shapes-three`: the same bytes as three's constructors
(`tests/exact-golden.test.ts`), cached by parameters. The dodecahedron rock is still three's own.

## Test area

`createUrbanTestModule(options)` and `loadUrbanTestModule(room, options)` put the city in the shared test room (`?area=urban` in `examples/urban-test-area`; the module also loads in `examples/interactables-test-area`).

- Items (17): the five poles of the kit in a row, a street grid with a filled block, a patch of terrain (a rolling plain with a river and a lake; `terrain` replaces it) and the ten neighbourhoods of the sample sheet in the Galeria's cells. Everything is drawn by the kit and this package, so a game that passes `urban: { packs, patch, remove }` sees its own catalogues in the area. Each item is scenery: one anchored slab of concrete as large as the sample.
- Bench: the neighbourhood, the seed, the share of lamps on (the pattern's own, all, half, none), the budget of real lights and, when asked, the species of the region and the vehicles of the fleet (a game gives `vehicles: (THREE) => createVehiclesThree(...)`; without it the bench parks no cars). Actions draw and take away the neighbourhood in front of the player; changing a setting draws it again.
- Layers: the reach of every real light and the box of each sample. Metrics: samples, draw calls, triangles, real lights, instances, objects of the bench and the light budget left.
- Eight scenarios, with no object of the room: pole heights, the light budget (the counter goes below zero as the page's), the dash every 5 m, block heights, the seed, burnt-out lamps, the terrain (vertex height, river bed, lake level) and the providers (vehicles of the fleet, species of the region).
- The room's camera sees 140 m and the sample sheet is 240 m wide, so the module lends the camera a 600 m view while it is loaded and gives the old one back when it detaches.
