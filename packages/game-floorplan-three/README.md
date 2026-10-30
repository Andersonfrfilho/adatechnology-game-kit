# @adatechnology/game-floorplan-three

The three.js renderer of `@adatechnology/game-floorplan`: it draws a generated plan as a house (walls, doors, windows, floors, slabs, stairs, roofs, gutters, lot,
furniture, lights, mirrors, cars, utilities) and binds it to the destruction of its structure. It is the port of the team's `Casa3DSDK` (Visor de casas 3D) and
`AndaresSDK` (floor navigator), literally: same geometry, same draws, same seeded random, so a plan looks the same as on the team's page
(`tests/golden-scene.test.ts` compares the scene node by node with the page's, for six plans).

```ts
import * as THREE from 'three'
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as structure } from '@adatechnology/game-floorplan-structure'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { create } from '@adatechnology/game-floorplan-three'

residential(engine, { region: 'br' })
structure(engine)
const plan = engine.generate('townhouse', { seed: 7, state: 'normal' })

const world = createDestruction({ seed: 1 })
const scene = new THREE.Scene()
const renderer = create(THREE, {
  destruction: world,
  destructionRenderer: createDestructionRenderer(THREE, { scene, world }),
  fleet, // optional: { build(kind, { quality, seed }) } of game-vehicles-fleet
  locale: 'en', // or 'pt-BR', or a table of messages
})
const house = renderer.build(plan, { quality: 'high', night: false })
scene.add(house.group)

// every frame
house.update(dt, performance.now(), camera.position) // doors, laundry, wind, distance LOD
```

## What it draws

| Part | Where |
|---|---|
| walls, doors, windows, floors, slabs, stairs, baseboards, outbuildings, building shell | `house.floors[i]` (one group per floor), `house.doors`, `house.stairs` |
| lot: ground, street, sidewalk, lot wall, gates, zones, fence | `house.lot` |
| roof, tiles, gutters | `house.roof`, `house.gutters` |
| furniture (`game-props3d` plus the house's own builders) | in the floor groups, merged by material; `renderer.types` is the map |
| lamps, switches, room lights | `house.lights`, `house.toggleLight(room)` |
| mirrors (the nearest one reflects when the camera is in its room) | `house.chooseMirror(camera)` |
| cars (needs a `fleet`) | `house.cars`, `renderer.cars` |
| solar panels, water, electrical, pipes | `house.solar`, `house.water`, `house.electrical` |

`house.group` is the root. Everything is merged to one mesh per group and material (a draw call each); only what moves stays apart.

## Furniture as a destructible spec

`furnitureSpec(THREE, type, { w?, d?, h?, seed?, options? })` runs the team's builder of `type` (`bookcase`, `shelf_unit`, `dining_table`, `coffee_table`... the keys of `renderer.types`) unchanged, with a recording stand-in for the drawing api, and returns `{ spec, build(THREE), top, size }`: one part per drawn box or cylinder (`wood_0`, `plain_17`: builder material key and drawing order), with the colour the builder gave it. Sizes default to the catalogue entry (`residentialItems`; `catalog` overrides it), `seed` drives the builder's random (the books), so the same seed gives the same piece.

```ts
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
const shelf = furnitureSpec(THREE, 'bookcase') // 1.2 x 0.35 x 2 m: uprights, back, boards and books
world.add(shelf.spec, { id: 'shelf', position: [-3.5, 0, 0] })
scene.add(shelf.build(THREE)) // meshes named by part id
const table = furnitureSpec(THREE, 'dining_table', { w: 1.6, d: 0.8, h: 0.78, options: { chairs: false } })
table.top // { part: 'wood_0_b2', y: 0.78, parts: ['wood_0_b0', ...] }: what loose things rest on (a solid wooden top is boards: it breaks board by board where it is hit)
```

`tapSpec(THREE, { kind: 'counter' | 'wall', reach? })` does the same for the team's tap (`counterTap` of the sink, `wallTap` of the laundry tub): the steel parts of the base, column, spout and lever, and `spout`, where the water thread starts (the thread itself is not drawn).

Materials: `wood` is `wood_hard` (`wood_soft` under 3.5 cm: boards, panels), `metal` is `steel`, `plain` is `plastic` (`paper` on shelves and racks: the books), `fabric`, `glass` and `plant` keep their name; `options.materials` overrides any key. Parts that touch the floor are anchored. Joints come from `inferJoints` (screws between wood...), except that paper rests on what it lies on with a weak `resting` joint, so books fall when their board breaks, and is not joined to its neighbours. `options.chairs: false` drops what the builder draws in a frame of its own (a table's chairs). Planes and leaves have no volume and are left out.

## A wall as the houses build it

`wallPiece(THREE, { w, h, thickness?, finish?, color?, house? })` is a free-standing wall (a target wall, a garden wall) made exactly like the walls of the houses: `wallPlan` gives a one-storey plan whose only wall is exterior on both sides, with the houses' masonry construction, and its structure is `buildStructure` of `game-floorplan-structure` without a roof (the wall on the strip footing, the concrete bond beam on it). The house renderer draws it (plaster and paint, baseboard, sidewalk) and gives the spec a house gives (`house.structure.spec()`: the plastered brick wall with its layers, units and breach, the bond beam with its rebar). `build(THREE)` returns the drawn wall with each mesh labelled by its part (`userData.destructionPart`), centred on the origin along x.

```ts
import { wallPiece } from '@adatechnology/game-floorplan-three'
const wall = wallPiece(THREE, { w: 10, h: 3 })
world.add(wall.spec, { id: 'target_wall', position: [0, 0, -11] })
scene.add(wall.build(THREE))
```

Any wall a scene, an area or a game needs is made this way, never drawn on its own: the same look and the same load path as the houses, so a change to the houses shows on every wall.

## Bound to the destruction

With `destruction` (a world of `game-destruction`) and `destructionRenderer` (`game-destruction-three`), the house registers itself in the world on first need
(`house.destruction.activate()`, or the first hit through `house.damage`):

- **One part per wall**, with the assembly of its masonry (units, breach, layers) and **the rebar of reinforced concrete on slabs, beams, pillars and stairs**.
- **A vertex range per piece.** Every wall, slab, window, door... knows its range in the merged mesh (`house.structure.meshesOf(id)`); the renderer's `bind` gets them,
  so fracture and collapse hide the range and the renderer lets the fragments fall. `house.destruction.reset()` puts everything back.
- **Brick courses at LOD 0.** A masonry wall that reaches stage 2 stops being a box: its range collapses and it is drawn again as instanced units (running bond,
  one instance per unit) without the ones inside the opening; the units around the edge show the bare brick. At LOD 1 and 2 the box comes back.
- **Spall decal and rebar cage** come from the destruction renderer (decals on hits, instanced bars when the concrete is exposed).
- `house.damage(id, point, type, amount)` keeps the legacy behaviour (hp of the part, `onDamage`) and becomes a hit in the world.

## Floor navigator

`createFloorNavigator()` is the team's AndaresSDK: a 10 cm grid per floor, stairs with banisters and U-turns, path fields, occlusion of the floors above.

```ts
import { createFloorNavigator, navigationDefOf, bindNavigator } from '@adatechnology/game-floorplan-three'

const navigator = createFloorNavigator()
navigator.register(navigationDefOf(house, { id: 'home', own: true })) // heights, wall colliders, flights, floor groups
const binding = bindNavigator(navigator, 'home', house) // wall stage 2 opens cells; a wall or slab that falls changes the grid
navigator.blocked(x, z, floor) // 1 blocked, 0 free, -1 use the ground grid
```

## Injected, never read from globals

| Option | What |
|---|---|
| `fleet` | cars (`game-vehicles-fleet`) |
| `reflector` | `THREE.Reflector` for the mirrors |
| `props` | `game-props3d` (default: the package's dependency) |
| `interactives` | `{ GameInteractables, GameInteractablesHousehold, GameInteractablesThree, adapter?, adapterOptions? }`: the interactable kit in place of the static furniture. The adapter (plan to kit objects) is `@adatechnology/game-floorplan-interactables` by default; `adapter` injects a game's own (an object with `plan`/`add`/`createWorld`/`blockedOf`, or a factory with `create()`), `adapterOptions` goes to `create()` (registries, `seedKey`, texts). |
| `vegetation` | `{ GameVegetation: { ...core, ...three }, GameVegetationSpecies }` |
| `textures`, `atlas`, `materials` | the app's replacements |
| `seedKey` | maps an id of the plan to the key its seeded draws use (to reproduce a scene drawn with other ids) |

Everything the house says to the player (prompts, messages) is in `locales` (`en`, `pt-BR`).

## Geometry

The kernel's three is `shapeGeometries(THREE)` of `@adatechnology/game-shapes-three`: the primitive templates the accumulator copies (box,
cylinders of 12 and 6 sides, the open cone, sphere, plane), the breach units, the fragments, the mirrors and the test area's specimens are made
by game-shapes, bit-identical to three's (`tests/exact-golden.test.ts`) and cached by parameters across renderers. The accumulator itself (one
mesh per group and material) keeps its own arithmetic: its transform, normals and world-projected uvs are not three's matrix order, so moving
it onto the core bake would change bytes (see the T9 design, §7.3).

## Build

`dist/index.js` (ESM, three.js and the other packages external), `dist/index.d.ts`, and `dist/index.global.js` exposing `GameFloorplanThree` (three.js is the page's own `THREE`).

See `.claude/skills/game-floorplan-three/SKILL.md` for the API and `MIGRATION.md` for the Portuguese names the Visor de casas 3D used.

## Em português

Desenho em three.js das plantas do `game-floorplan`: porte literal do `Casa3DSDK` (Visor de casas 3D) e do `AndaresSDK` (navegação por andares). Paredes, portas, janelas,
pisos, lajes, escadas, telhado, calhas, lote, móveis, luzes, espelhos e carros; cada peça sabe a faixa de vértices que ocupa na malha fundida para a destruição
(fratura, colapso, fileiras de tijolo no LOD 0, decalque de lascamento e armadura aparente). Os pacotes (frota, interativos, vegetação, espelho) são injetados. Os
textos vêm de `locales` (`en`, `pt-BR`).
