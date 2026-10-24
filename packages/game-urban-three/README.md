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
- `draw(scene, { root })` draws into a group of yours. Works on three r128 and later.

The scene hash, the lists of instances and the surface of each material (shadows, roughness, metalness, flat shading) of 34 cases are tested against the page.
