# @adatechnology/game-shapes

The kit's single 3D generator. A shape is a JSON document (primitives, extrusions, lathes, a cheap boolean, transforms, groups, named parts,
materials by id, LOD rules, instancing hints); `generate` turns it into typed-array buffers per material, ready for one draw call each. No
renderer, no dependency: it runs the same in a page, a Web Worker or Node, and the same input always gives the same bytes.

Every generator is a line-by-line port of three.js r160's (`BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`,
`PlaneGeometry`, `CircleGeometry`, `RingGeometry`, `LatheGeometry`, `TorusGeometry`, `ExtrudeGeometry` for straight outlines), and baking uses
three's matrix arithmetic in three's order, so the arrays are **bit-identical** to what three builds. That is what lets the kit's packages move
their builders here without any scene golden changing. `@adatechnology/game-shapes-three` turns the buffers into meshes.

Design and rules: `specs/001-migracao-entregas-dos-times/design/T9-game-shapes-e-desempenho.md`.

## Install

```sh
pnpm add @adatechnology/game-shapes
```

Browser without a bundler (the global is `GameShapes`):

```html
<script src="https://unpkg.com/@adatechnology/game-shapes/dist/index.global.js"></script>
```

## Usage

```ts
import { generate, type ShapeSchema } from '@adatechnology/game-shapes'

const stool: ShapeSchema = {
  version: 1,
  name: 'stool',
  materials: { wood: { color: 0x8a643c, roughness: 0.8 }, metal: { roughness: 0.35, metalness: 0.7 } },
  root: {
    kind: 'group',
    children: [
      { kind: 'cylinder', name: 'seat', material: 'wood', color: 0x8a643c, radiusTop: 0.18, radiusBottom: 0.18, height: 0.04, radialSegments: 16, position: [0, 0.46, 0] },
      // the same leg three times: an instancing hint
      { kind: 'cylinder', material: 'metal', color: 0x9a9ea2, radiusTop: 0.012, radiusBottom: 0.012, height: 0.44, radialSegments: 6, position: [0.12, 0.22, 0],
        instances: [{ heading: 0 }, { heading: 2.094 }, { heading: 4.189 }] },
      { kind: 'group', part: 'lid', position: [0, 0.48, 0], children: [{ kind: 'box', size: [0.1, 0.01, 0.1], material: 'wood' }] },
      { kind: 'point', name: 'sit', position: [0, 0.5, 0], data: { seat: true } },
    ],
  },
  lod: [{ distance: 12, detail: 0.5, minSize: 0.02 }],
  cullDistance: 40,
}

const buffers = generate(stool, { seed: 1 })
buffers.levels[0].batches // [{ material: 'wood', part: null, positions, normals, uvs, colors, indices, ranges, bounds }, { material: 'wood', part: 'lid', ... }]
buffers.levels[0].instanced // [{ material: 'metal', geometry, matrices (16 per copy), count: 3 }]
buffers.parts // [{ id: 'lid', position: [0, 0.48, 0], matrix }]
buffers.points // [{ name: 'sit', part: null, position: [0, 0.5, 0], data: { seat: true } }]
buffers.stats // { vertices, triangles, batches, instances, primitives }
```

One primitive on its own, not baked (exactly three's arrays, from a shared template cache):

```ts
import { buildPrimitive } from '@adatechnology/game-shapes'
const cylinder = buildPrimitive({ kind: 'cylinder', radiusTop: 0.5, radiusBottom: 0.35, height: 1, radialSegments: 14 })
cylinder.type // 'CylinderGeometry'
```

## Nodes

Common fields: `name` (named range in `ranges`), `part` (a movable part: its transform is the pivot, relative to the root; its children are baked
in the part's space), `material` (id, inherited), `color` (`0xRRGGBB` or `'#rrggbb'`, inherited), `uv` (atlas cell `{ u0, v0, u1, v1 }`),
`position` / `rotation` / `rotationOrder` / `scale` (three's `Object3D` composition, order `XYZ` by default), or `heading` + `position` (a rotation
about +y built as a rotation matrix), or `matrix` (16 numbers, column-major), `instances` (draw the node once per entry), `minDetail` (LOD), `tags`.

| Kind | Parameters (defaults are three's) |
|---|---|
| `group` | `children` |
| `box` | `size: [w, h, d]`, `segments` |
| `cylinder` | `radiusTop`, `radiusBottom`, `height`, `radialSegments`, `heightSegments`, `openEnded`, `thetaStart`, `thetaLength` |
| `cone` | `radius`, `height`, `radialSegments`, `heightSegments`, `openEnded`, `thetaStart`, `thetaLength` |
| `sphere` | `radius`, `widthSegments`, `heightSegments`, `phiStart`, `phiLength`, `thetaStart`, `thetaLength` |
| `plane` | `width`, `height`, `widthSegments`, `heightSegments` |
| `circle`, `ring` | as three's `CircleGeometry`, `RingGeometry` |
| `lathe` | `points: [[x, y], ...]`, `segments`, `phiStart`, `phiLength` |
| `torus` | `radius`, `tube`, `radialSegments`, `tubularSegments`, `arc` |
| `extrude` | `shape: { outer, holes? }` (straight edges), `depth`, `steps`, `bevel: false \| { thickness, size, offset, segments }` |
| `difference` | `size`, `subtract: [{ min: [x, y], max: [x, y] }]`: a box minus prisms through it along z (walls with windows and doors) |
| `mesh` | `positions`, `normals?` (computed when missing), `uvs?`, `indices?` |
| `point` | `data`: an anchor reported in `points` |
| `custom` | `generator`, `params`: a function registered with `registerGenerator(name, (params, { random, seed, detail, path }) => node)` |

The JSON Schema ships as `@adatechnology/game-shapes/schema.json` (`SHAPE_SCHEMA`); `validateShape(doc)` checks the same rules without a schema
engine and returns one message per problem with its path; `generate` throws on an invalid shape (pass `validate: false` to skip the check).

## Options

| Option | Meaning |
|---|---|
| `seed` | Seed of custom generators (each node gets its own stream from seed, generator and node path) |
| `colors` | `'linear'` (three's working space, default), `'srgb'` or `'none'` |
| `indexed` | `false` for non-indexed batches |
| `materials`, `fallbackMaterial` | Material ids the host draws; any other id becomes the fallback |
| `materialAlias` | `{ metal: 'plain' }`: ids that share a draw (as when two ids share one material instance) |
| `instancing: { minCount }` | Instance identical leaf primitives repeated at least `minCount` times (off by default) |
| `levels` | Only these level indices |
| `generators` | Custom generators for this call only |

## Buffers

`ShapeBuffers = { key, levels: [{ distance, detail, batches, instanced }], parts, points, materials, cullDistance, stats }`. A batch is one
(part, material): `positions`, `normals`, `uvs` (`Float32Array`), `colors`, `indices` (`Uint16Array`, `Uint32Array` above 65 535 vertices),
`ranges` and `bounds`. Batches come in the order of first use, the static body first. Every array owns its buffer: `transferablesOf(buffers)`
lists them for `postMessage`; cached results are shared and read-only (`cloneBuffers` before deforming). `shapeKey(schema, options)` is the
64-bit cache key; `mergeTransformed(pieces)` is three's `toNonIndexed` + `applyMatrix4` + join, for merging existing geometry.

## Cache and workers

```ts
import { createShapeCache, createShapePool } from '@adatechnology/game-shapes'

const cache = createShapeCache({ maxEntries: 512, maxBytes: 128 * 1024 * 1024 }) // LRU by shapeKey, counted in bytes of the arrays
const pool = createShapePool({ size: 4, spawn: () => new Worker(new URL('./shape-worker.js', import.meta.url), { type: 'module' }), cache })
const house = await pool.generateMany(rooms.map((schema) => ({ schema, options: { seed } })))

// shape-worker.js
import { installShapeWorker } from '@adatechnology/game-shapes/worker'
installShapeWorker(self, { generators: myGenerators })
```

- A cache hit resolves at once; a key already in flight shares its promise; otherwise the job goes to the least busy worker and every array
  comes back transferred (zero copy). The result is shared: read-only.
- `spawn` returns anything with `postMessage`, `onmessage` and `terminate` (a browser `Worker`, a `worker_threads` wrapper, a fake). Without it,
  or with `size: 0`, the pool generates in the calling thread with the same cache and sharing.
- Custom generators are functions: register them in the worker script too. A job whose options carry `generators` runs in the calling
  thread. A worker that crashes rejects its jobs and is replaced.
- A worker result is byte-equal to `generate` in the calling thread for the same key (tested with `worker_threads`).

## LOD and instancing

A `lod` rule `{ distance, detail, minSize?, minSegments? }` regenerates the tree with round segment counts times `detail` (never below
`minSegments`, default 3), leaves out nodes with `minDetail > detail` and leaves smaller than `minSize`, and bakes the parts at rest into the
static body. Instance a node when the same geometry repeats tens of times or is placed at run time; merge when copies are few or coloured per
vertex.

## Generators by instance

`createShapes({ packs, patch, remove })` makes a set of generators of its own. `packs` is a list of objects `{ [name]: ShapeGenerator }` (`[{ 'my.stones': stones }]`); later packs replace earlier ones with the same name.
`patch` replaces a generator by name, `remove` lists names to take out. `shapes.generate` looks custom nodes up in that set only. For a pool use `createShapePool({ generators: shapes.record(), isolatedGenerators: true })`: its jobs then run in the calling thread and never see the global registry.

## Português

Gerador único de 3D do kit: forma em JSON vira buffers por material, puro, por semente, pronto para worker e cache. Os geradores são portes linha a
linha do three r160 e o resultado é igual bit a bit, por isso os pacotes migram sem mudar nenhum golden de cena. O desenho em three.js fica no
`@adatechnology/game-shapes-three`. O `createShapePool` gera em workers (`installShapeWorker` no script do worker) e o `createShapeCache` guarda
os resultados por chave.
