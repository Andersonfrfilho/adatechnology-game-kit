# @adatechnology/game-shapes-three

The three.js side of [`@adatechnology/game-shapes`](../game-shapes): buffers become geometries, meshes, part groups, `InstancedMesh` and `LOD`.
three.js is passed in by the host; the package never imports it.

## Install

```sh
pnpm add @adatechnology/game-shapes @adatechnology/game-shapes-three three
```

Browser without a bundler: `dist/index.global.js` exposes `GameShapesThree` (game-shapes is bundled in; three.js is yours).

## Usage

```ts
import * as THREE from 'three'
import { generate } from '@adatechnology/game-shapes'
import { shapeGeometries, toGeometry, toObject3D, mergeByMaterial } from '@adatechnology/game-shapes-three'

// a whole shape: one mesh per (part, material), part groups at their pivots, instances, a LOD when there are levels
const { object, parts, meshes, instanced, points, materials } = toObject3D(THREE, generate(schema), { materials: { wood: myWood } })
scene.add(object)
parts.door.rotation.y = 1.2

// three's constructors, made by game-shapes (bit-identical, instances of three's classes, template cache)
const T = shapeGeometries(THREE)
const handle = new T.CylinderGeometry(0.05, 0.065, 1.1, 10) // instanceof THREE.CylinderGeometry, type 'CylinderGeometry'

// one primitive or one batch
const geometry = toGeometry(THREE, buildPrimitive({ kind: 'torus', radius: 0.3, tube: 0.02 }))
```

| Export | What it does |
|---|---|
| `toGeometry(THREE, primitiveOrBatch, { copy })` | A `BufferGeometry`; a primitive gets three's `type`, `parameters` and the prototype of the class it reproduces, its attributes in three's order, its index and groups. `copy: false` shares the arrays (read-only) |
| `shapeGeometries(THREE, { cache })` | A namespace equal to `THREE` except `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`, `PlaneGeometry`, `CircleGeometry`, `RingGeometry`, `LatheGeometry`, `TorusGeometry` and `ExtrudeGeometry` (one straight-edged shape; curves, several shapes, a path or a custom uv generator fall back to three). Hand it as `T` to code ported from the teams |
| `toObject3D(THREE, buffers, { materials, materialFor, shadows, copy, name })` | `{ object, near, parts, meshes, instanced, points, materials }`; meshes are named `static:<material>` / `part:<id>` with `userData.material`, `userData.part` and `userData.ranges`; levels after the first are static (parts baked at rest), and `cullDistance` ends the `LOD` |
| `createMaterials(THREE, hints, ids)` | `MeshStandardMaterial` per id from the schema's material hints (vertex colours on) |
| `mergeByMaterial(THREE, root, space)` | Every visible mesh under `root` baked into `space` and joined per material (non-indexed), on game-shapes' merge; the same bytes `game-props3d`'s version gave |
| `releaseObject3D(roots, { keep })` | Frees the GPU side of trees taken out of the scene for good: geometries, materials, textures (maps and shader uniforms) and skeletons, except what a tree in `keep` (the scene) still uses or what is marked `userData.shared`. Returns how many it freed |
| `discardObject3D(objects, { keep })` | `removeFromParent()` plus `releaseObject3D` for one object or a list (one walk of the scene), keeping what the rest of its scene draws: the one call for something that leaves the game |
| `isMesh(object)` | Type guard for a mesh (or a skinned or instanced one) met while walking a tree with `traverse` |
| `markShared(...resources)` | Marks a palette, kit or catalog resource as shared on purpose, so the release never frees it; same as `userData.shared = true` without touching the resource (digests and goldens stay) |

## Português

Desenho three.js das formas do `game-shapes`: geometria com o tipo e o protótipo da classe do three, malha por lote, grupos de peça, instâncias e
LOD; o `shapeGeometries(THREE)` é o `T` que o código portado dos times recebe para continuar escrevendo `new T.CylinderGeometry(...)`.

Tudo o que sai da cena para sempre passa por `discardObject3D` ou `releaseObject3D` (regra de memória do kit, `CLAUDE.md` seção 7): o three.js só libera a GPU no `dispose()`.
