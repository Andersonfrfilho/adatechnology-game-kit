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
- A `terrain` part becomes the square mesh with vertex colours (flat shaded, roughness 1, casts and receives shadows); the water is a plane part drawn after it.
- A `placement` part (a vehicle of the fleet, a species of the pack) becomes a group at the spot, turned and scaled, holding the object a resolver made: `createUrbanThree(THREE, { resolvers: { vehicle: createVehicleResolver(vehiclesThree), plant: createPlantResolver(THREE) } })`. The vehicle resolver uses the `lite` build of `game-vehicles-three` (six fused meshes) and the plant resolver `generate` and `createPlantObject` of `game-vegetation`; each is built once for an id and paint (or seed) and cloned for every spot, sharing geometry and materials. An id the package does not know leaves the spot empty. `resolver.dispose()` frees them.
- `draw(scene, { root })` draws into a group of yours. Works on three r160 and later.

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
