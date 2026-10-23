# @adatechnology/game-fluids-three

three.js renderer for [`@adatechnology/game-fluids`](../game-fluids). It only reads the simulation state, so it draws exactly what the
deterministic world says (a LAN client with the same state draws the same liquids). `three` is a peer dependency used for types only: you pass your
own `THREE` instance at runtime.

What it draws:

- **Liquid in containers**: inside every bound object, the container's inner shape clipped by the world-space liquid surface, so the top is always
  on the surface plane whatever the tilt (upright, lying down, upside down). One material per liquid (colour, opacity, roughness from gloss).
  Steam puffs rise from a hot surface.
- **Streams**: a thread along the ballistic path (tube updated in place) that narrows as it accelerates, with a drop that grows at the leading tip
  and a trailing drop when it ends; thin streams are a sequence of falling drops.
- **Stains**: a smooth fan from the 16 flow-front radii (never a perfect disc), lying on the surface plane a hair above it
  (`polygonOffset`, oriented by the stain's normal), tinted by the liquid with a soft rim, plus an inner glossy fan at `wetRadius` that reflects
  the environment and recedes while it dries. A dried mark is a faint matte patch.
- **Splashes**: pooled round droplets (`THREE.Points` with a small `ShaderMaterial`, the round sprite is drawn in the fragment shader, no textures).

Lit with the standard material, no transmission, a handful of draw calls, fixed budgets per quality.

## Install

```sh
pnpm add @adatechnology/game-fluids-three @adatechnology/game-fluids three
```

Browser without a bundler (the global is `GameFluidsThree`; it bundles the few `game-fluids` helpers it calls, you still load `GameFluids` to create the world):

```html
<script src="https://unpkg.com/three/build/three.min.js"></script>
<script src="https://unpkg.com/@adatechnology/game-fluids/dist/index.global.js"></script>
<script src="https://unpkg.com/@adatechnology/game-fluids-three/dist/index.global.js"></script>
<script>
  const fluids = GameFluids.createFluids({ seed: 1 })
  const view = GameFluidsThree.createFluidRenderer(THREE, { scene, fluids })
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { createFluids } from '@adatechnology/game-fluids'
import { createFluidRenderer } from '@adatechnology/game-fluids-three'

const fluids = createFluids({ seed: 7 })
fluids.addSurface({ id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [10, 10], porosity: 0.05 })
fluids.addContainer(
  { capacity: 0.25, liquid: 'coffee', liters: 0.25, temperature: 90, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 },
  { id: 'cup' },
)

const view = createFluidRenderer(THREE, { scene, fluids, quality: 'medium', envMap })
view.bindContainer('cup', cupObject, { innerOffset: [0, 0.005, 0] }) // inner bottom centre in the object's space

// every frame
const p = cupObject.localToWorld(new THREE.Vector3(0, 0.005, 0)) // world position of the inner bottom centre
fluids.setTransform('cup', [p.x, p.y, p.z], [q.x, q.y, q.z, q.w])
fluids.update(dt)
view.update(dt)
```

`innerOffset` is the offset, in the bound object's space, of the origin of the container shape (the inner bottom centre). The transform given to
`fluids.setTransform` must be that point's world position and the object's world rotation. Objects are assumed to have uniform scale.

Destroying a container's object (for example from `@adatechnology/game-destruction`): call `view.unbindContainer(id)` and
`fluids.removeContainer(id)`; the stains already on the floor stay and dry on their own.

## API

`createFluidRenderer(THREE, options)` returns a `FluidRenderer`.

| Option | |
|---|---|
| `scene` | Where the effects are added (one `fluid_renderer` group) |
| `fluids` | The `FluidWorld` to draw |
| `quality` | `'low'`, `'medium'` (default) or `'high'`: sets the mesh resolution and the budgets below |
| `envMap` | Environment map the wet surfaces reflect (otherwise `scene.environment` if the host set one) |
| `pointScale` | Pixel scale of the point sprites, about half the canvas height (default 600) |

| Method | |
|---|---|
| `bindContainer(containerId, object3D, { innerOffset? })` | Draw the liquid of a world container inside the object |
| `unbindContainer(containerId)` | Remove that liquid |
| `update(dt)` | Advance the visuals; call it after `fluids.update(dt)` |
| `clear()` | Remove stains, streams and particles (bindings stay) |
| `dispose()` | Remove everything from the scene and free geometries and materials |
| `stats()` | `{ quality, containers, streams, stains, particles, triangles, budget }` |

Budgets: stains 24 / 48 / 96, streams 12 / 24 / 48 and particles 96 / 256 / 512 for low / medium / high. When the world has more stains than the
budget, the newest are drawn.

Types exported: `FluidRenderer`, `FluidRendererOptions`, `FluidRendererStats`, `BindOptions`, `FluidQuality`, `ThreeLib`. `smoothOutline(front, subdiv)` is
exported too (the periodic Catmull-Rom used for the stain rim).

## Português

Renderizador three.js do `@adatechnology/game-fluids`: o líquido dentro do recipiente (um volume cortado pelo plano da superfície, sempre
horizontal no mundo), fios de líquido com gota na ponta, manchas que crescem a partir de uma frente de fluxo (nunca um disco perfeito), brilho de
superfície molhada que reflete o cenário e seca da borda para dentro, vapor e gotas de respingo. Só lê o estado da simulação, então é igual em LAN.

```ts
const view = createFluidRenderer(THREE, { scene, fluids, quality: 'medium', envMap })
view.bindContainer('copo', objetoDoCopo, { innerOffset: [0, 0.005, 0] })
// a cada frame: fluids.setTransform(...); fluids.update(dt); view.update(dt)
```
