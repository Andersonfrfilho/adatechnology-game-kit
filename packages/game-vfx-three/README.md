# @adatechnology/game-vfx-three

The three.js renderer of [`@adatechnology/game-vfx`](../game-vfx). It draws a `VfxWorld` with the shaders of the Explosion Lab and lends the host an
`EffectSink` (`@adatechnology/game-contracts`) so modules ask for effects by id without bringing particles of their own.

- **Puffs**: one icosahedron instance each, faceted, with the five-band posterised heat ramp, the noise dissolve and the banded light of the Lab
  (shader verbatim; the only change is the r160 `colorspace_fragment` chunk). **Shrapnel** streaks, additive **halos**, the **shock** shell and the dust
  ring on the ground, glowing **debris** (two instanced meshes, rocks and plates), the **blast lights** and **fire lights** as point lights.
- **Marks**: scorch, dirt, rim rocks and blood as meshes. A scorch or dirt mesh conforms to the ground as it was when the mark was made, so craters
  and marks agree. `createGroundPatch(THREE, { field })` is the Lab's 60 m patch as a mesh that follows a `GroundField`.
- **Screen**: `overlay` puts the Lab's white flash (`mix-blend-mode: screen`) and the Workshop's white, red edge, sides and gas tint inside your container.
  `applyCamera()` shakes the camera for the render that follows and answers the function that puts it back.
- Lights use the raw colours of the Lab and are multiplied by `lightScale` (default `Math.PI`: r155+ lights are physical, the Lab's r128 ones were not).

```ts
import * as THREE from 'three'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'

const vfx = createVfxRenderer(THREE, { scene, camera, overlay: container, vfx: { profile: 'high', seed: 1 } })
vfx.play({ effect: 'm67', point: [0, 0.1, 0], seed: 7 }) // EffectSink: a handle, or null for an unknown id

// every frame: steps the world, redraws, then render with the shake around it
vfx.update(dt)
const restore = vfx.applyCamera()
gl.render(scene, camera)
restore()
```

Pass a `VfxWorld` as `vfx` to share one world between renderers (the test room does): the renderer that owns the loop calls `update`, nobody else.
`configure({ lod_band: 'auto' | 'near' | 'middle' | 'far' })` forces the scale. In Node (tests) pass `createCanvas` so the marks can draw their textures.

## Install

```sh
pnpm add @adatechnology/game-vfx-three three
```

Browser without a bundler (the global is `GameVfxThree`; load three.js first):

```html
<script src="https://unpkg.com/@adatechnology/game-vfx-three/dist/index.global.js"></script>
<script>
  const vfx = GameVfxThree.createVfxRenderer(THREE, { scene, camera })
</script>
```
