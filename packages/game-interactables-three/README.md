# @adatechnology/game-interactables-three

three.js adapter for [`@adatechnology/game-interactables`](../game-interactables) and for content packs that draw through a
`HouseholdApi` (the `PropsApi` of [`@adatechnology/game-props3d`](../game-props3d) plus `part(id, pivot, ry, draw)`).

It turns the primitives of a content pack into a few merged meshes, moves the parts the world animates, and draws the effects, screens,
mirrors and cords of the world. `three` is a peer dependency imported **as a type only**: the host passes its own `THREE` (and `Reflector`)
in, so there is never a second copy of three in the bundle. No assets, no other runtime dependencies.

## Install

```sh
pnpm add @adatechnology/game-interactables-three three
```

Browser without a bundler (the global is `GameInteractablesThree`):

```html
<script src="https://unpkg.com/@adatechnology/game-interactables-three/dist/index.global.js"></script>
<script>
  const adapter = GameInteractablesThree.createThreeAdapter(THREE, { document })
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { createThreeAdapter } from '@adatechnology/game-interactables-three'

const gfx = createThreeAdapter(THREE, { document, Reflector, envMap })

// 1. build an object: every primitive is merged into one geometry per material, every part into its own group
const { api, finish } = gfx.createMeshApi({ quality: 'game' })
pack.build('wardrobe', {}, api) // your content pack draws through api.box / cylinder / leaf / plane / light / part
const { group, parts } = finish() // parts: { door: Group, drawer_1: Group, ... }
scene.add(group)

// 2. each frame
world.update(dt)
gfx.syncObject(world, 'wardrobe-1', parts, { time: clock.elapsedTime })
effects.update(dt, world.emitters())
mirrors.update(camera, world.mirrors([x, y, z], 6))
```

Every function also exists unbound and takes `THREE` first: `createMeshApi(THREE, options)`, `applyPose(THREE, group, motion, t)`, ...

### Mesh api

`createMeshApi(THREE, { materials, quality, shadows })` returns `{ api, finish, materials }`.

- Implements `box`, `cylinder` (shapes `cyl`, `cyl6`, `cone`, `sphere`), `leaf`, `plane` (with atlas `uv`), `light` and `part`.
- Static primitives are baked (vertex colors) into **one `BufferGeometry` per material**: the draw calls of the static body are the number
  of materials in use (`plain`, `metal`, `wood`, `glass`, `fabric`, `plant`, `water`, `emissive`, `atlas_picture`, `atlas_floor`).
- `part(id, pivot, ry, draw)` routes everything drawn inside `draw` into a group of its own, merged per material as well. The group origin is
  the pivot and it is turned by `ry`, so a hinge or slide axis is expressed in the part frame. Names are `part:<id>` and `userData.part = id`
  on the group **and** its meshes, so `raycaster.intersectObject(group, true)[0].object.userData.part` gives the part that was hit.
- `M.x`, `M.z`, `M.ry` of each primitive's item are applied; pivots are object-local, coordinates drawn inside a part are relative to its pivot.
- `materials` maps keys to your materials; missing keys get defaults with `vertexColors` (`MeshStandardMaterial` for `quality: 'high'`,
  `MeshLambertMaterial` for `'game'`, which also uses fewer segments). Atlas materials are yours to provide (a `CanvasTexture` of the atlas).
- `api.light` creates a `PointLight` inside the right group; `finish()` also returns them as `lights`.
- **Draw calls in `game` quality.** `plain`, `metal`, `wood` and `fabric` are one shared Lambert material, so they merge into one mesh per
  target. `finish(spec)` (pass the spec the pack returned; option `mergeParts`, default on in `game` quality) also merges the parts of one
  `PartSpec.group` that share a motion (blind slats: a per-vertex pivot in the vertex shader, one set of uniforms, shadows follow) and the
  `cloth` soft volumes (clothes on a line: one mesh, a per-vertex cloth index and anchor, each cloth keeps its own swing). `parts[id]` then
  points at the merged group (`userData.merged`) and `syncObject` drives it. Parts with a mirror, a turned part (`ry`) or a lone part stay as they are.
  Measured on the household pack: blinds 38 meshes to 3, clothesline 31 to 2.

### Poses and sync

`applyPose(THREE, group, motion, t)` poses a part from its `Motion` (hinge / rocker / knob rotate, slide translates, scale scales along
the axis). The rest pose is remembered in `group.userData.rest`, so calling it every frame never drifts. `syncObject(THREE, world, objectId,
parts, { time })` applies every part's t from the world and the swing of every soft volume (the group under `soft.part ?? soft.id`).

### Cloth sway that casts the right shadow

```ts
const handle = gfx.attachSway(clothMesh, { amplitude: 0.04 })
```

`swayMaterial(THREE, base, { amplitude, anchorY })` clones the material and patches the vertex shader (uniforms `time`, `ax`, `az`,
`anchorY`) so vertices hang from the anchor line and swing. The **same patch** goes into `customDepthMaterial` (directional and spot
shadows) and `customDistanceMaterial` (point-light shadows), so shadows follow the animation instead of flickering. `attachSway` sets all
three on a mesh; `syncObject` drives its uniforms from `world.sway(...)`.

### Effects

```ts
const effects = gfx.createEffects(scene, { maxParticles: 800, document })
effects.update(dt, world.emitters(), camera) // the camera's fov sizes the point sprites
effects.setViewHeight(renderer.domElement.height) // on resize
```

Smoke and steam (thick, soft, rising and growing), fire (additive, yellow to red), sparks and water. One `Points` per kind, fixed buffers,
swap-remove, no allocations per frame; the total alive never exceeds `maxParticles` (split by kind). The sprite is painted on a canvas from
`document`, or generated as a data texture without one. Seeded, so the same seed gives the same plumes. Sprite sizes use the camera's
vertical `fov` (and `zoom`), read on every `update` (or `setCamera(camera)`); without a camera a 90 degree lens is assumed.

- **Water** (intensity 0.25 and up) is a tapered, translucent stream mesh with scrolling streaks along the gravity arc from the outlet down
  to the floor (`floorY` option) or to `emitter.reach` meters below it (a tap ends in the basin), plus spray droplets around it and a splash
  with a little mist where it lands. A thin emitter (tap) narrows as it falls, a wide one (shower) opens up. One draw call per stream
  (`maxStreams`, default 6). Low intensities drip.
- **Gas `flame`** is a ring of small blue cones per burner (all rings share one mesh, one draw call, `maxFlames`) plus a soft glow.
- The meshes live in `effects.meshes` (`group`, `streams`, `flames`).

### Screens

```ts
const tv = gfx.createScreen({ w: 128, h: 72 })
tvMesh.material = tv.material
tv.setOn(true); tv.setChannel(2); tv.update(dt)
```

Canvas texture: black and not emissive when off; when on, channel 0 is color bars, 1 static noise, 2 an animated landscape (higher
numbers repeat them with shifted hues).

### Mirrors

```ts
const mirrors = gfx.createMirrors({ max: 1, resolution: 512 })
mirrors.register('wardrobe-1:mirror', mirrorMesh) // world id objectId:mirrorId
mirrors.update(camera, world.mirrors(eye, 6)) // returns the ids that got a real reflector
```

Registered meshes show an env-map material. The nearest `max` facing the camera get a pooled `Reflector`, placed 1 mm in front of the plane
with the mesh's rotation and size. Without a `Reflector` everything stays on the env map.

**`renderer.info` and the Reflector.** three's `Reflector` renders the scene again inside the main `render()`; that nested render resets
`renderer.info` (when `info.autoReset` is on), so `info.render.calls` would only count the reflector pass. `createMirrors({ keepInfo })`
(default `true`) wraps the reflector so the counters of the main pass are added back and `info.render.calls` / `triangles` cover the whole
frame. A host that sets `renderer.info.autoReset = false` and resets it itself is left alone.

### Cords

`createCord(THREE, points, radius, material)` builds a tube; `catenary(a, b, sag, n)` returns `n` points of a hanging cord whose lowest
point is `sag` meters below the chord.

## Notes

- `poseOf` converts the pose math of the interactables package (same defaults) to a quaternion, so the rendered part always matches the engine.
- Everything is deterministic: effects and screen noise use seeded generators.

## Destruction

`finish(spec)` copies the spec's destruction tags to Three objects so a destruction host can find what each mesh is made of: `userData.destructionMaterial` (SDK material id) on the static meshes (object default) and on each part group and its meshes, and, on part groups and their meshes, `userData.destructionPart` (the part id, as `@adatechnology/game-destruction-three` expects), `userData.destructionPiece` and `userData.destructionJoint`. Parts merged into a shared group (blind slats) carry the tags of the first part. The damage itself is done by `@adatechnology/game-destruction`; this package only tags. Without a spec nothing is tagged.

## Português

Adaptador three.js para o `@adatechnology/game-interactables`. Recebe as primitivas dos packs de conteúdo (`box`, `cylinder`, `leaf`,
`plane`, `light` e `part`) e as junta em **uma geometria por material**, com cada parte móvel (porta, gaveta, tampa) em um grupo próprio com
a origem no pivô. O `THREE` é sempre passado pelo jogo (o pacote só importa tipos).

```ts
const gfx = createThreeAdapter(THREE, { document, Reflector, envMap })
const { api, finish } = gfx.createMeshApi({ quality: 'game' })
pack.build('guarda_roupa', {}, api)
const { group, parts } = finish()
scene.add(group)
// a cada quadro
gfx.syncObject(world, 'guarda-roupa-1', parts, { time: clock.elapsedTime })
```

Também traz `swayMaterial` / `attachSway` (balanço de roupa no vertex shader, com material de profundidade e de distância iguais, para a
sombra acompanhar), efeitos em pool (fumaça, fogo, vapor, água, faíscas), telas com canais animados, espelhos com `Reflector` só para o mais
próximo, e cabos (`createCord`, `catenary`).
