# Fase 9 — `game-shapes` e desempenho do 3D (desenho, 2026-10-24)

Decisão do dono (2026-10-24): *"o 3D de tudo, o gerador de 3D deveria ser um SDK que aceita JSON e transforma na forma, e aí outros SDK
utilizam ele"*, feito depois dos ports e junto com o trabalho de desempenho (tempo, paralelismo). This document is the design; the slices
(a) to (e) of §10 implement the first part of it.

## Summary

- **`@adatechnology/game-shapes`** (new, no three): a JSON shape schema (primitives, extrusions, lathes, cheap booleans, transforms, groups,
  named parts, materials by id, LOD rules, instancing hints) in, typed-array buffers per material out (positions, normals, uvs, colours,
  indices, named ranges, parts). Pure and deterministic by seed, Web Worker friendly (transferable buffers), cacheable by `(schema hash, seed,
  options)`.
- **`@adatechnology/game-shapes-three`** (new): buffers to `BufferGeometry`, `Mesh`, `InstancedMesh` and `LOD`; a geometry namespace whose
  `BoxGeometry`, `CylinderGeometry`... are made by `game-shapes`, so code ported literally from the teams keeps reading `new T.BoxGeometry(...)`;
  and `mergeByMaterial`, which moves here from `game-props3d`.
- **Exactness is the contract.** Every generator is a line-by-line port of the three r160 generator it replaces, with the same operation order,
  so the buffers are equal **bit for bit** (not "within 1e-4") to what three builds. That is what lets every package move without touching its
  scene goldens: the scene-hash cannot change. A path that cannot match exactly stays on three and is listed (§7.3).
- **Performance** is measured before it is changed: a timing bench per builder with a CI ceiling expressed as a regression budget against a
  calibration loop (§8), then parallel generation in workers, a cache by seed, merged geometry per material, instancing for repeats and LOD.

Three findings shape the design:

- **Most of the kit already describes geometry before drawing it.** `game-props3d` builders call a renderer-agnostic primitive api
  (`box`, `cylinder`, `leaf`, `plane`, `light`); the household packs use the same api plus `part`; `game-vegetation` turns a `PlantSpec` into
  buffers with no three at all. What each `-three` package then does with those calls is the same thing written five times: a template per
  primitive (unit box, 12-sided cylinder, sphere...) baked by a matrix into one growing buffer per material (`interactables-three/mesh.ts`,
  `floorplan-three/kernel/geometry.ts` + `furniture/api.ts`, `items-three/merge.ts` through `props3d/mergeByMaterial`, `weapons-three/props.ts`,
  `vehicles-three/lite.ts`). `game-shapes` is that pipeline once.
- **The scene goldens hash geometry by type name, vertex count, rounded positions, index count and bounds** (`tools/golden/src/scene-hash.ts`).
  A geometry made by `game-shapes` must therefore also carry three's `type` (`"CylinderGeometry"`), and its buffers must be three's. Both are
  cheap once the generators are exact ports.
- **r128 and r160 generators are identical for every primitive the kit uses except two.** Measured on this repo's two three builds
  (same parameters, bitwise): Box, Cylinder, Cone, Sphere, Plane, Torus, Circle and Ring give the same position, normal, uv and index arrays;
  **Lathe** differs in normals and index order and **Extrude** in uvs (`WorldUVGenerator`). The packages whose tests still run three 0.128
  (`game-urban-three`, `game-vegetation-three`, `game-vehicles`, `-fleet`, `-three`) can therefore move to `game-shapes` for everything but lathes
  and extrusions without an r128 variant (§11, question 3).

## 1. Inventory of the geometry builders

Triangle counts come from the committed goldens (`tests/fixtures/team-golden/*.json`, index count / 3 per mesh) or, for packages without a
scene golden, from building every builder once through its own `-three` path (`props3d` and the household packs through
`interactables-three/createMeshApi`, quality `high`). "Constructors" counts the `X.YGeometry(` calls in `src/`.

| Package | Files that make geometry | Primitive kinds (constructors) | How geometry is made today | Typical triangles | Three in tests | Scene goldens |
|---|---|---|---|---|---|---|
| `game-props3d` | `src/builders/*.ts` (57 builders); `merge-by-material.ts`; `node-skin.ts` | box, cylinder (`cyl`, `cyl6`, `cone`, `sphere`), leaf, plane (atlas uv), light | Primitive api only; the host draws. `mergeByMaterial` bakes a three tree per material; `createNodeSkin` bakes a tree into one skinned mesh | median 256, max 3 700 (`garden_bed`), 2 draw calls median | r160 | `game-animal-skin.json` (node skin) |
| `game-interactables-household` | `src/*.ts` (51 types) | the props3d api + `part(id, pivot, ry, draw)` | Primitive api only | median 528, max 3 866 (`wardrobe`), 4 draw calls median | — | — |
| `game-interactables-three` | `mesh.ts` (7), `merge.ts`, `cord.ts`, `effects.ts`, `mirrors.ts` | Box, Cylinder (12/8 and 6 sides), cone, Sphere (12×8 / 8×6), Plane, leaf (double-sided diamond), Tube (cords) | **Accumulator**: three templates baked by `frame(M) × compose(YXZ)` into one indexed buffer per (target, material); parts get their own group | as the packs above | r160 | none (bounds and contract tests) |
| `game-items-three` | `kit.ts` (5), `shapes.ts` (3), `models/*.ts` (7), `area.ts` (14) | Box, Cylinder, Cone, Sphere (with phi/theta ranges), Lathe, Torus, Extrude (bevel), Tube (Catmull-Rom) | **One mesh per part** (kit helpers over three constructors, ported literally); `mergeItem` and `buildItemLod` merge through `mergeByMaterial` | 24 showcase models: median 336, max 1 060, 5 meshes median | r160 | `items-showcase.json` (24 scenes) |
| `game-weapons-three` | `models/kit.ts` (5), `models/*.ts`, `props.ts`, `fx/*`, `world-explosives.ts`, `box-fx.ts` | Box, Cylinder, Torus, Sphere, Cone, Icosahedron, Tube, rounded box | One mesh per part via `modelKit`; props merged by `mergeByMaterial` | 31 gallery models: median 280, max 13 088 | r160 | `gallery-models.json`, `gallery-model-hashes.json` (99) |
| `game-vehicles` | `geometry.ts`, `wheels.ts`, `lights.ts`, `body.ts`, `context.ts`, `particles.ts`, `fluids.ts`... (85) | Cylinder, Box, Sphere, Torus, Shape, Extrude, Plane, Circle, Ring, Tube, Lathe, Tetrahedron, custom BufferGeometry (lofts, warps) | One mesh per part; lofted bodies built in custom buffers | high: 150 000–250 000 per vehicle, ~470 meshes | r128 | the fleet garage goldens |
| `game-vehicles-fleet` | `vehicles/*.ts` (82) | Torus, Cylinder, custom BufferGeometry, Sphere, Cone, Shape, Extrude | Same as `game-vehicles` (content) | see above | r128 | `garage-*.json` (4 × 3 scenes) |
| `game-vehicles-three` | `lite.ts`, `build.ts` | — (fuses the fleet's meshes) | **Fusion** into 6 classes (paint, trim, metal, glass, light, plate), prune under 3 cm | lite: 4 400–26 600 (median 17 500), 6 draw calls | r128 | `lite.json` (tris, draw calls, vertex hashes) |
| `game-floorplan-three` | `kernel/geometry.ts` (7), `furniture/api.ts`, `house/*`, `lot/*`, `cars.ts`, `mirrors.ts`, `test-area/specimens.ts` | box, cyl (12, 6 sides), open cone, sphere 10×8, plane, leaf (single face), custom walls and roofs | **Accumulator** (`Float32Array` that doubles), one mesh per (group, material); props3d builders drawn through its own `furniture/api.ts` | 24 house scenes: median 27 600, max 87 500, 86 meshes median | r160 | `vc3-house-scene.json`, `vc3-house-area.json` |
| `game-floorplan` | silhouettes | Box, Extrude, Cylinder, Plane | One mesh per part | 260–1 276 | r160 | `gallery-silhouettes.json` |
| `game-characters-three` | `rich/person-builder.ts` (21), `rich/accessories/*` (72), `rich/person-kit.ts`, `wounds/*` (17), `instanced/*` | Cylinder (69), Sphere (23), Torus, Shape, Cone, Box, Lathe, Circle, Ring, Dodecahedron, Capsule | One mesh per part (portraits); the crowd bakes a body per variant into an instanced body geometry | per person a few thousand; crowd instanced | r160 | `portraits-people.json`, `game-best-body.json`, `game-instanced-body.json` |
| `game-animals-three` | `quadruped.ts`, `bird.ts`, `snake.ts`, `extras.ts`, `context.ts` (`addMesh`) | Box, Cylinder, Cone, Sphere, Torus, Lathe, Circle | One mesh per part, then `createNodeSkin` (one draw per animal) | 13 species: 6 900–17 900, ~55 meshes | r160 | `animals-page.json` (65 scenes) |
| `game-urban-three` | `draw.ts` (9), `rounded-box.ts` (3) | Plane, Cylinder, Box, Extrude, Dodecahedron, Cone, rounded box, prism | One mesh per part plus instanced lists | parts median 400, max 3 400; a street pattern 71 000 in 924 meshes | r128 | `urban-parts.json`, `urban-patterns.json`, `urban-terrain.json` |
| `game-vegetation` / `-three` | `generate.ts` (no three), `three/objects.ts`; `-three/test-area/*` | Plant pieces (prisms, cones, leaves) | **Already renderer-agnostic**: `generate(PlantSpec, { seed, lod })` returns buffers (`PlantMesh`); the adapter makes the mesh | — | r128 | module goldens |
| `game-crowd-three` (Phase 8) | `renderer.ts`, `instances.ts`, `herd-view.ts` | none of its own (0 constructors) | **Instances only**: each crowd type is baked by `game-characters-three` (rich builder → instanced body variants at 3 LODs, `createVariantBatches`); every agent, body on the ground and civilian is one instance per frame; the herd uses the animals' rigs | thousands of agents in a few draw calls | r160 | `game-crowd-render.json` (instances per scene, events) |
| Effects: `game-vfx-three`, `game-fluids-three`, `game-weather-three`, `game-destruction-three` | `instanced.ts`, `mesh-layer.ts`, `film/*`, `rain-curtain.ts`, `fragments.ts`, `rebar.ts`... | Plane, Sphere, Icosahedron, Cone, Circle, Ring, Box, Extrude, InstancedBufferGeometry, per-frame buffers | Per-frame pools and shaders, a handful of templates | — | r160 | effect goldens (events, not scenes) |
| `game-test-room`, `game-audio` | `arena.ts`, `explosives.ts`, `build-from-spec.ts`; `bench/module.ts` | Cylinder, Box, Sphere, Plane, Cone | One mesh per object of the room | small | r160 | — |

### 1.1 What is shared

1. **The same seven templates.** Unit box, 12-sided cylinder, 6-sided cylinder, cone, sphere, plane and a leaf appear in
   `interactables-three/mesh.ts`, `floorplan-three/kernel/geometry.ts` and (through `props3d`) every prop. The radii and segment counts differ
   (interactables: radius 1, 12 or 8 sides; floorplan: radius 0.5, cone 0.3→0.5 open; sphere 12×8 vs 10×8), and the two leaves are different
   meshes (double-sided diamond with 8 vertices vs single face with 4). They are therefore parameters of one generator, not one template.
2. **The same bake.** A template, a matrix (item frame × primitive transform), a normal matrix, a colour per vertex, an atlas remap of the uvs,
   appended into a buffer per material. The three implementations differ only in the matrix chain and in whether the index type is chosen per
   vertex count (interactables) or always 32 bits (floorplan).
3. **The same merge.** `mergeByMaterial` (de-index, bake the world matrix, join per material) is called by `items-three` and `weapons-three`;
   `vehicles-three` does a classed variant of it; `createNodeSkin` and the crowd add a node index per vertex.
4. **The same kit helpers.** Items (`kit.ts`), weapons (`models/kit.ts`), animals (`context.ts`), characters (`person-kit.ts`) and vehicles
   (`kit.ts`) each wrap `new T.XGeometry(...)` and `new T.Mesh(...)` in short helpers so the team code reads like the page. Those helpers are the
   seam where `game-shapes-three` plugs in without editing the ported model code.
5. **Nothing is cached across builds** except the interactables templates (per mesh api) and the floorplan `GEO` table (per kernel). The same
   cylinder of 12 sides is regenerated thousands of times in a house.

## 2. The schema

A shape is a JSON document. The node tree is what a builder describes; generation turns it into buffers. TypeScript types are in
`packages/game-shapes/src/types.ts`, and the JSON Schema below is `packages/game-shapes/schema/shape.schema.json` (a test keeps the file, the
exported `SHAPE_SCHEMA` constant and this section's rules in step).

### 2.1 Nodes

Every node has a `kind` and the common fields:

| Field | Meaning |
|---|---|
| `name` | Named range: the vertices and indices the node adds are reported per batch (`ranges`), for picking, damage, swapping |
| `part` | Starts a movable part: the node's transform becomes the part's pivot (reported in `parts`), its children are baked in the part's space. Parts are placed relative to the root (an ancestor's transform does not move a part); two nodes with the same `part` add to the same part, the first transform wins |
| `material` | Material id, inherited by the children (default `"default"`) |
| `color` | Vertex colour, `0xRRGGBB` or `"#rrggbb"`, inherited (default white) |
| `uv` | `{ u0, v0, u1, v1 }`: the primitive's uvs remapped into that atlas cell (`u0 + u × (u1 − u0)`) |
| `position`, `rotation`, `rotationOrder`, `scale` | Local transform, composed as three does (Euler → quaternion → matrix; order default `XYZ`; `scale` a number or a vec3) |
| `heading` | Rotation about +y built directly as a rotation matrix (`cos`, `sin`) with `position`, the "turn of an item on the floor" every placer uses; exclusive with `rotation`, `scale` and `matrix` |
| `matrix` | A column-major 4 × 4 matrix, exclusive with the other transform fields |
| `instances` | Instancing hint: the node is drawn once per entry (each a transform, optionally with its own `color`), placed between the parent and the node |
| `minDetail` | LOD: the node is left out of levels whose `detail` is lower |
| `tags` | Free strings carried to `ranges` (`destruction:glass`, `skip:lite`...) |

Kinds (all sizes in metres, angles in radians; the parameters and defaults are three r160's):

| Kind | Parameters | Three equivalent (`type`) |
|---|---|---|
| `group` | `children` | — |
| `box` | `size: [w, h, d]`, `segments?: [x, y, z]` | `BoxGeometry` |
| `cylinder` | `radiusTop`, `radiusBottom`, `height`, `radialSegments` (32), `heightSegments` (1), `openEnded`, `thetaStart`, `thetaLength` | `CylinderGeometry` |
| `cone` | `radius`, `height`, `radialSegments`, `heightSegments`, `openEnded`, `thetaStart`, `thetaLength` | `ConeGeometry` |
| `sphere` | `radius`, `widthSegments` (32), `heightSegments` (16), `phiStart`, `phiLength`, `thetaStart`, `thetaLength` | `SphereGeometry` |
| `plane` | `width`, `height`, `widthSegments`, `heightSegments` | `PlaneGeometry` |
| `circle` | `radius`, `segments`, `thetaStart`, `thetaLength` | `CircleGeometry` |
| `ring` | `innerRadius`, `outerRadius`, `thetaSegments`, `phiSegments`, `thetaStart`, `thetaLength` | `RingGeometry` |
| `lathe` | `points: [[x, y], ...]`, `segments` (12), `phiStart`, `phiLength` | `LatheGeometry` |
| `torus` | `radius`, `tube`, `radialSegments`, `tubularSegments`, `arc` | `TorusGeometry` |
| `extrude` | `shape: { outer: [[x, y], ...], holes?: [[[x, y], ...]] }`, `depth`, `steps`, `bevel: false \| { thickness, size, offset, segments }` | `ExtrudeGeometry` (straight edges; curves are sampled by the caller) |
| `difference` | `size: [w, h, d]`, `subtract: [{ min: [x, y], max: [x, y] }]`: a box minus rectangular prisms that go all the way through it along z (walls with windows and doors) | — (the only boolean that is cheap and exact; anything else is an open question) |
| `mesh` | `positions`, `normals?` (computed as three's `computeVertexNormals` when missing), `uvs?`, `indices?` | `BufferGeometry` |
| `point` | `data`: an anchor (a light, a muzzle, a seat), reported in `points` with its position in its part's space | — |
| `custom` | `generator`, `params`: a generator registered by the host (`registerGenerator(name, (params, ctx) => node)`, `ctx.random` seeded) | whatever it returns |

`detail` (from LOD, §5) multiplies the segment counts of `cylinder`, `cone`, `sphere`, `circle`, `ring`, `lathe` and `torus`, rounded and never
below `minSegments` (default 3; the item shapes use 5, as `seg()` does today).

### 2.2 The document

```ts
interface ShapeSchema {
  version: 1
  name?: string
  /** Renderer-agnostic hints per material id; game-shapes-three makes a MeshStandardMaterial from them when the host passes none. */
  materials?: Record<string, MaterialHint>
  root: ShapeNode
  /** Levels after the base one; see §5. */
  lod?: LodLevel[]
  /** Distance from which nothing is drawn. */
  cullDistance?: number
}
```

### 2.3 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Andersonfrfilho/adatechnology-game-kit/packages/game-shapes/schema/shape.schema.json",
  "title": "game-shapes shape",
  "type": "object",
  "required": ["version", "root"],
  "additionalProperties": false,
  "properties": {
    "version": { "const": 1 },
    "name": { "type": "string" },
    "materials": { "type": "object", "additionalProperties": { "$ref": "#/$defs/material" } },
    "root": { "$ref": "#/$defs/node" },
    "lod": { "type": "array", "items": { "$ref": "#/$defs/lodLevel" } },
    "cullDistance": { "type": "number", "exclusiveMinimum": 0 }
  },
  "$defs": {
    "number": { "type": "number" },
    "count": { "type": "integer", "minimum": 0 },
    "vec2": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
    "vec3": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
    "mat4": { "type": "array", "items": { "type": "number" }, "minItems": 16, "maxItems": 16 },
    "color": { "oneOf": [{ "type": "integer", "minimum": 0, "maximum": 16777215 }, { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" }] },
    "uvRect": {
      "type": "object", "additionalProperties": false, "required": ["u0", "v0", "u1", "v1"],
      "properties": { "u0": { "type": "number" }, "v0": { "type": "number" }, "u1": { "type": "number" }, "v1": { "type": "number" } }
    },
    "rotationOrder": { "enum": ["XYZ", "YXZ", "ZXY", "ZYX", "YZX", "XZY"] },
    "transform": {
      "type": "object",
      "properties": {
        "position": { "$ref": "#/$defs/vec3" },
        "rotation": { "$ref": "#/$defs/vec3" },
        "rotationOrder": { "$ref": "#/$defs/rotationOrder" },
        "scale": { "oneOf": [{ "type": "number" }, { "$ref": "#/$defs/vec3" }] },
        "heading": { "type": "number" },
        "matrix": { "$ref": "#/$defs/mat4" }
      }
    },
    "instance": {
      "allOf": [{ "$ref": "#/$defs/transform" }],
      "properties": { "position": true, "rotation": true, "rotationOrder": true, "scale": true, "heading": true, "matrix": true, "color": { "$ref": "#/$defs/color" } },
      "unevaluatedProperties": false
    },
    "material": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "color": { "$ref": "#/$defs/color" },
        "roughness": { "type": "number", "minimum": 0, "maximum": 1 },
        "metalness": { "type": "number", "minimum": 0, "maximum": 1 },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
        "transparent": { "type": "boolean" },
        "emissive": { "$ref": "#/$defs/color" },
        "emissiveIntensity": { "type": "number", "minimum": 0 },
        "side": { "enum": ["front", "back", "double"] },
        "flatShading": { "type": "boolean" },
        "vertexColors": { "type": "boolean" },
        "depthWrite": { "type": "boolean" }
      }
    },
    "lodLevel": {
      "type": "object", "additionalProperties": false, "required": ["distance", "detail"],
      "properties": {
        "distance": { "type": "number", "minimum": 0 },
        "detail": { "type": "number", "exclusiveMinimum": 0, "maximum": 1 },
        "minSize": { "type": "number", "minimum": 0 },
        "minSegments": { "type": "integer", "minimum": 3 }
      }
    },
    "common": {
      "allOf": [{ "$ref": "#/$defs/transform" }],
      "properties": {
        "kind": { "type": "string" },
        "name": { "type": "string" },
        "part": { "type": "string" },
        "material": { "type": "string" },
        "color": { "$ref": "#/$defs/color" },
        "uv": { "$ref": "#/$defs/uvRect" },
        "instances": { "type": "array", "items": { "$ref": "#/$defs/instance" } },
        "minDetail": { "type": "number", "exclusiveMinimum": 0, "maximum": 1 },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    },
    "node": {
      "type": "object",
      "required": ["kind"],
      "allOf": [{ "$ref": "#/$defs/common" }],
      "oneOf": [
        { "properties": { "kind": { "const": "group" }, "children": { "type": "array", "items": { "$ref": "#/$defs/node" } } } },
        { "properties": { "kind": { "const": "box" }, "size": { "$ref": "#/$defs/vec3" }, "segments": { "type": "array", "items": { "type": "integer", "minimum": 1 }, "minItems": 3, "maxItems": 3 } } },
        { "properties": { "kind": { "const": "cylinder" }, "radiusTop": { "type": "number" }, "radiusBottom": { "type": "number" }, "height": { "type": "number" }, "radialSegments": { "type": "integer", "minimum": 1 }, "heightSegments": { "type": "integer", "minimum": 1 }, "openEnded": { "type": "boolean" }, "thetaStart": { "type": "number" }, "thetaLength": { "type": "number" } } },
        { "properties": { "kind": { "const": "cone" }, "radius": { "type": "number" }, "height": { "type": "number" }, "radialSegments": { "type": "integer", "minimum": 1 }, "heightSegments": { "type": "integer", "minimum": 1 }, "openEnded": { "type": "boolean" }, "thetaStart": { "type": "number" }, "thetaLength": { "type": "number" } } },
        { "properties": { "kind": { "const": "sphere" }, "radius": { "type": "number" }, "widthSegments": { "type": "integer", "minimum": 3 }, "heightSegments": { "type": "integer", "minimum": 2 }, "phiStart": { "type": "number" }, "phiLength": { "type": "number" }, "thetaStart": { "type": "number" }, "thetaLength": { "type": "number" } } },
        { "properties": { "kind": { "const": "plane" }, "width": { "type": "number" }, "height": { "type": "number" }, "widthSegments": { "type": "integer", "minimum": 1 }, "heightSegments": { "type": "integer", "minimum": 1 } } },
        { "properties": { "kind": { "const": "circle" }, "radius": { "type": "number" }, "segments": { "type": "integer", "minimum": 3 }, "thetaStart": { "type": "number" }, "thetaLength": { "type": "number" } } },
        { "properties": { "kind": { "const": "ring" }, "innerRadius": { "type": "number" }, "outerRadius": { "type": "number" }, "thetaSegments": { "type": "integer", "minimum": 3 }, "phiSegments": { "type": "integer", "minimum": 1 }, "thetaStart": { "type": "number" }, "thetaLength": { "type": "number" } } },
        { "required": ["points"], "properties": { "kind": { "const": "lathe" }, "points": { "type": "array", "items": { "$ref": "#/$defs/vec2" }, "minItems": 2 }, "segments": { "type": "integer", "minimum": 1 }, "phiStart": { "type": "number" }, "phiLength": { "type": "number" } } },
        { "properties": { "kind": { "const": "torus" }, "radius": { "type": "number" }, "tube": { "type": "number" }, "radialSegments": { "type": "integer", "minimum": 1 }, "tubularSegments": { "type": "integer", "minimum": 1 }, "arc": { "type": "number" } } },
        {
          "required": ["shape"],
          "properties": {
            "kind": { "const": "extrude" },
            "shape": {
              "type": "object", "required": ["outer"], "additionalProperties": false,
              "properties": {
                "outer": { "type": "array", "items": { "$ref": "#/$defs/vec2" }, "minItems": 3 },
                "holes": { "type": "array", "items": { "type": "array", "items": { "$ref": "#/$defs/vec2" }, "minItems": 3 } }
              }
            },
            "depth": { "type": "number" },
            "steps": { "type": "integer", "minimum": 1 },
            "bevel": {
              "oneOf": [
                { "const": false },
                { "type": "object", "additionalProperties": false, "properties": { "thickness": { "type": "number" }, "size": { "type": "number" }, "offset": { "type": "number" }, "segments": { "type": "integer", "minimum": 1 } } }
              ]
            }
          }
        },
        {
          "required": ["size", "subtract"],
          "properties": {
            "kind": { "const": "difference" },
            "size": { "$ref": "#/$defs/vec3" },
            "subtract": { "type": "array", "items": { "type": "object", "required": ["min", "max"], "additionalProperties": false, "properties": { "min": { "$ref": "#/$defs/vec2" }, "max": { "$ref": "#/$defs/vec2" } } } }
          }
        },
        { "required": ["positions"], "properties": { "kind": { "const": "mesh" }, "positions": { "type": "array", "items": { "type": "number" } }, "normals": { "type": "array", "items": { "type": "number" } }, "uvs": { "type": "array", "items": { "type": "number" } }, "indices": { "type": "array", "items": { "$ref": "#/$defs/count" } } } },
        { "properties": { "kind": { "const": "point" }, "data": {} } },
        { "required": ["generator"], "properties": { "kind": { "const": "custom" }, "generator": { "type": "string" }, "params": {} } }
      ]
    }
  }
}
```

The validator in `game-shapes` (`validateShape`) checks the same rules without a JSON Schema engine (no dependency), and reports a path per
error (`root.children[3].radialSegments: expected an integer >= 1`).

## 3. The buffer format

```ts
interface ShapeBuffers {
  /** Cache key: hash of the canonical schema text, the seed and the options that change the output. */
  readonly key: string
  /** Level 0 first (detail 1, distance 0), then one per `lod` rule. */
  readonly levels: readonly ShapeLevel[]
  readonly parts: readonly ShapePart[]        // id, position, rotation, rotationOrder, scale (as given) and matrix
  readonly points: readonly ShapePoint[]      // name, part, position, data
  readonly cullDistance?: number
  readonly stats: { vertices: number; triangles: number; batches: number; instances: number; primitives: number }
}
interface ShapeLevel { readonly distance: number; readonly detail: number; readonly batches: readonly ShapeBatch[]; readonly instanced: readonly InstancedBatch[] }
interface ShapeBatch {
  readonly material: string                   // after the alias table
  readonly part: string | null                // null: the static body
  readonly positions: Float32Array            // xyz
  readonly normals: Float32Array              // xyz, unit
  readonly uvs: Float32Array                  // uv
  readonly colors?: Float32Array              // rgb, linear (three's working space) or sRGB, by option
  readonly indices?: Uint16Array | Uint32Array // Uint32 above 65 535 vertices; absent with `indexed: false`
  readonly ranges: readonly NamedRange[]      // name, tags, vertexStart, vertexCount, indexStart, indexCount
  readonly bounds: { min: [number, number, number]; max: [number, number, number] }
}
interface InstancedBatch { readonly material: string; readonly part: string | null; readonly name?: string; readonly geometry: PrimitiveBuffers; readonly matrices: Float32Array; readonly colors?: Float32Array }
interface PrimitiveBuffers { readonly type: string; readonly parameters: object; positions; normals; uvs; indices?; groups: { start; count; materialIndex }[] }
```

- **One batch per (part, material)**, in order of first use: the static body first, then the parts in the order they first appear. This is the
  order `createMeshApi` builds meshes in today, so the migrated mesh api produces the same scene.
- **Merged batches are baked:** every vertex is multiplied by its world matrix (relative to its part), its normal by the normal matrix and
  normalised. The arithmetic is three's (`Matrix4.compose`, `Quaternion.setFromEuler`, `Matrix3.getNormalMatrix`, `Vector3.normalize`),
  in the same order, on the Float32-rounded template, so the result is bit-identical to `createMeshApi` and to `BufferGeometry.applyMatrix4`.
- **A primitive on its own** (`buildPrimitive(node)`) is not baked: it is exactly the three geometry (attributes, index, groups), which is what
  the kit helpers of items, weapons, animals and characters need.
- **Transferable:** every array owns its `ArrayBuffer` (no views into a shared pool), so `transferablesOf(buffers)` lists them for `postMessage`.
  Cached buffers are shared and read-only by contract; a consumer that deforms a mesh copies first (`cloneBuffers`, or `copy: true` in
  `game-shapes-three`).
- **Options that change the output** and are part of the key: `seed`, `colors` (`linear`, `srgb`, `none`), `indexed`, `materialAlias`,
  `materials` (known ids) with `fallbackMaterial`, `instancing` (auto rule), `levels` (subset).

## 4. Cache and workers

**Cache.** `shapeKey(schema, options)` is a 64-bit FNV-1a (two 32-bit lanes) of the canonical JSON text of the schema (keys sorted, numbers as
JavaScript prints them, `-0` kept as `-0`) plus the options above. `createShapeCache({ maxEntries, maxBytes })` is an LRU of `ShapeBuffers` by
key, counted in bytes of the arrays. Inside the generator a second, module-level cache keeps **primitive templates** by their parameter text, so
the 12-sided cylinder of a house is generated once per process, not once per call. Both caches are pure memoisation: a hit returns the same
bytes a miss would produce (tested).

**Seed.** The schema itself is data and has no randomness; the seed only reaches `custom` generators (`ctx.random`, a mulberry32 stream from
`(seed, generator name, node path)`), so two nodes never share a stream and adding a node does not shift the others.

**Workers.** `@adatechnology/game-shapes/worker` has `installShapeWorker(scope, { generators })` for the worker script, and the main thread has
`createShapePool({ size, spawn, cache, generators })`:

- `spawn()` returns anything with `postMessage` / `onmessage` / `terminate` (a browser `Worker`, a Node `worker_threads` wrapper in tests, or an
  in-thread fake), so the pool has no environment dependency; with `size: 0` or no `spawn` it generates in the calling thread.
- `pool.generate(schema, options)` returns a promise of `ShapeBuffers`: a cache hit resolves at once, an in-flight key is shared, otherwise the
  job goes to the least busy worker; the reply transfers every array (zero copy).
- `pool.generateMany(list)` spreads a list (a whole house, a street) over the workers and resolves in input order.
- Custom generators must be registered on both sides (the worker script imports the same registration module); an unknown generator fails the
  job with its name.
- Result equality: a worker result is byte-equal to an in-thread result for the same key (tested with `worker_threads`).

## 5. LOD and instancing rules

**LOD.** `lod: [{ distance, detail, minSize?, minSegments? }]` adds levels after the base one. A level regenerates the tree with the segment
counts scaled by `detail` (never below `minSegments`), leaves out nodes with `minDetail > detail` and leaf nodes whose bounding radius is under
`minSize`, and **bakes the parts at their rest pose into the static body** (a far level never animates, so it costs one batch per material).
`cullDistance` ends the chain. `game-shapes-three` turns the levels into a `THREE.LOD` (level 0 keeps the part groups the host animates, the far
levels are static, and an empty `Group` at `cullDistance`). Defaults the packages already use and keep: items `lod1Ratio = 0.5` with
`minSegments = 5` at a third of the cull distance (30 m small, 60 m large); vehicles' light mode stays its own fusion until `game-vehicles`
migrates (§7).

**Instancing.**

1. Explicit: a node with `instances` is never merged; it becomes an `InstancedBatch` per material of its subtree (geometry in the node's
   space, one matrix per entry, an instance colour when entries have `color`). Use it for repeats the builder knows about: fence posts, slats,
   bricks, bolts, street lamps.
2. Automatic (option `instancing: { minCount }`, off by default so merged output stays equal to the old paths): identical leaf primitives
   (same kind, parameters, material and colour, no `name`, outside parts) repeated at least `minCount` times in a shape are instanced instead of
   merged.
3. When to choose which: merge when the copies are few, small or differently coloured per vertex (one draw call, no per-instance cost);
   instance when the same geometry repeats tens of times or more, or when the copies are placed at run time (vegetation scatter, crowds, debris).
   A merged batch above 65 535 vertices switches to 32-bit indices; above about 1 M vertices split by part or by distance band instead.

## 6. `game-shapes-three`

- `toGeometry(THREE, primitive | batch)` → `BufferGeometry` with `position`, `normal`, `uv`, `color` and the index; a primitive gets three's
  `type`, `parameters` and **the prototype of the three class it reproduces** (`instanceof THREE.LatheGeometry`, `clone()` and `toJSON()` keep
  working), so a scene that used to hold a `CylinderGeometry` hashes the same.
- `shapeGeometries(THREE)` → a namespace with the same constructors as three (`BoxGeometry`, `CylinderGeometry`, `ConeGeometry`,
  `SphereGeometry`, `PlaneGeometry`, `CircleGeometry`, `RingGeometry`, `LatheGeometry`, `TorusGeometry`, `ExtrudeGeometry` for straight shapes)
  backed by `game-shapes` and its template cache; everything else is three's own. A kit hands it to the ported team code as `T`.
- `toObject3D(THREE, buffers, { materials, materialFor, shadows, copy })` → a `Group` with one mesh per batch (`static:<material>` /
  `part:<id>`), part groups at their pivots, `InstancedMesh` per instanced batch, a `LOD` when there are levels, and the points as data.
- `createMaterials(THREE, hints)` → `MeshStandardMaterial` per material id from the schema hints.
- `mergeByMaterial(THREE, root, space)` → moved from `game-props3d` (which re-exports it), now a call to the core merge
  (`mergeTransformed`) with matrices read from three.

## 7. Migration

### 7.1 The rule

**A package migrates only if its scene goldens stay byte-identical.** Concretely, per package:

1. If the package has no scene golden of what it builds (props3d builders, household packs, interactables mesh api), record one **from the old
   path first** and commit it: per builder, the scene-hash lines plus an exact hash of every buffer (the bytes of positions, normals, uvs, colours
   and indices, not rounded). A golden that rounds to 4 decimals is not enough to call a port exact.
2. Move the builders onto `game-shapes`.
3. Every golden of the package (the new one and the existing team goldens) passes unchanged; no fixture file is touched. The scene-hash code is not
   touched.
4. A geometry path that cannot match exactly stays on its old path and is listed in §7.3 with the reason. "Close enough" is not an option.

### 7.2 Order

| # | Package | What moves | Golden that proves it | Notes |
|---|---|---|---|---|
| 1 | `game-props3d` | `createShapeRecorder()`: the primitive api writes a `ShapeSchema` with the conventions of the mesh api (base of the box at `y`, `YXZ`, `heading` frame per item, part nodes, lights as points); `mergeByMaterial` moves to `game-shapes-three` | new `props3d-shapes.json`: the 57 builders through the old mesh api, exact buffer hashes | slice (e) |
| 2 | `game-interactables-three` | `createMeshApi` = recorder + `generate` + `toObject3D`, same groups, names, userData, merges and destruction tags | new `mesh-api.json`: the 57 props and 51 household types at both qualities, exact buffer hashes and scene lines | slice (e) |
| 3 | `game-items-three` | the kit's `T`, `cyl`, `bx`, `lathe`, `torus` (and `extrude`) from `shapeGeometries`; `mergeItem` through the new `mergeByMaterial` | `items-showcase.json` (24 team scenes) + new exact hashes of the 25 shapes and the LOD levels | slice (e) |
| 4 | `game-weapons-three` | `models/kit.ts` `T`, `props.ts` merge | `gallery-models.json`, `gallery-model-hashes.json` | |
| 5 | `game-animals-three` | `context.ts` `addMesh` geometry; the node skin stays | `animals-page.json`, `game-animal-skin.json` | |
| 6 | `game-characters-three`, then `game-crowd-three` | `person-kit.ts`, accessories, wounds templates; the variant bake; the crowd's per-frame instance matrices stay in `game-crowd-three` (they are animation, not generation) | `portraits-people.json`, `game-best-body.json`, `game-instanced-body.json`, `game-crowd-render.json` | the crowd changes nothing until the bake moves |
| 7 | `game-vegetation(-three)` | `PlantMesh` becomes a `mesh` node (or `ShapeBuffers` directly); the nursery's pots and stakes | module goldens | r128 in tests: only kinds proven equal on r128 |
| 8 | `game-urban-three` | `draw.ts`, rounded box, prism; the instanced lists become `instances` | `urban-parts.json`, `urban-patterns.json`, `urban-terrain.json` | r128; extrusions stay until §11 q3 |
| 9 | `game-floorplan-three` | the kernel accumulator and `furniture/api.ts` onto the core bake (its own templates as parameters, 32-bit indices by option) | `vc3-house-scene.json`, `vc3-house-area.json`, `gallery-silhouettes.json` | the largest win (§8): 24 houses, 1 750 meshes |
| 10 | `game-vehicles`, `-fleet`, `-three` | the kit's primitive helpers, then the lite fusion on the core merge | the four garage goldens, `lite.json` | r128; lofts and warps are custom buffers and stay `mesh` nodes |
| — | effects (`vfx`, `fluids`, `weather`, `destruction-three`) | only their static templates, if any | their goldens | per-frame buffers stay where they are |

### 7.3 Stays on the old path (filled in as packages migrate)

| Path | Package | Why |
|---|---|---|
| `TubeGeometry` (Catmull-Rom curves, Frenet frames) | items (`crowbar`), interactables (`cord.ts`), weapons, vehicles | Not ported yet: the curve's arc-length table and the centripetal `pow` make an exact port a slice of its own |
| `createNodeSkin` | props3d, animals | Reads three materials and textures (colour sampled at the uv) to bake per-vertex surface data; it is a bake of an existing tree, not generation |
| `ShapeGeometry`, `ExtrudeGeometry` with curves, Dodecahedron / Icosahedron / Tetrahedron, Capsule | characters, vehicles, urban, vfx | Not used by the first three migrations; added when their package migrates |
| Lathe and Extrude under three r128 | urban, vegetation, vehicles | r128's lathe normals and index order and extrude uvs differ from r160's (measured); see §11 q3 |

## 8. Performance plan

### 8.1 Timing bench with a CI ceiling

`tools/shapes-bench` (private) times every builder of the packages it knows, in Node, with three r160 and the stub documents the tests use:

- entries are `{ id: '<package>/<builder>', run() }`; props3d's 57, the 51 household types (both through the interactables mesh api), the 24 item
  models and the 25 item shapes, the weapon models, the 13 animals, a few vehicles in light mode and the `game-shapes` generators themselves;
- each entry is warmed up, then run until 150 ms or 40 runs, and the **median** is kept;
- a **calibration loop** (fixed arithmetic and allocation, no kit code) is timed the same way, and every median is stored as a ratio to it, so
  the numbers mean the same on a laptop and on a CI runner;
- `baseline.json` holds those ratios; `bench --check` fails when an entry is slower than `baseline × (1 + budget)` (budget 0.5 by default, per-entry
  overrides for noisy ones) and the entry is above a noise floor (entries under 0.05 ms are reported, never failed); `bench --update` rewrites it.
  The ceiling is a **regression budget**, not an absolute time;
- the CI job `shapes-bench` runs `--check` on Node 22 after the build and writes the table to the job summary.

### 8.2 Parallel generation

The pool of §4: schemas are built on the main thread (cheap: they are plain objects), buffers in workers, transferred back. The kit's builders
are synchronous today, so the first users are the ones that build many independent things at load: the houses of a block, the props of a
house, the item showcase, the vehicles of a street. The api is a promise per shape plus `generateMany`, so a loader can show progress.

### 8.3 Cache by seed

The same `(schema, seed)` is generated once (LRU of §4). Inside a build, the template cache removes the repeated generation of the same
primitive (the measured cost of a props builder is mostly template work and array growth today). The cache also lets a world store only seeds
and rebuild geometry on demand.

### 8.4 Fewer draw calls and triangles

- Merged geometry per material is the default of `generate` (the mesh api already did it; items and weapons do it at the end with a second pass
  over three objects, which `game-shapes` makes unnecessary because the merge happens on the buffers, before any three object exists).
- Instancing for repeats (§5) and LOD levels (§5) for items, props and houses.
- Typed arrays sized in a first pass instead of `number[]` that grow and are copied into `Float32Array` at the end.

The bench gives the numbers before and after each migration in the commit message of the migration.

## 9. Proposed rule for CLAUDE.md (not applied; the owner decides)

To add as a new item in §1 or §3 of `CLAUDE.md`:

> **Todo 3D novo passa pelo `game-shapes`** (dono, 2026-10-24). Modelo, peça, móvel, prédio ou efeito novo é descrito como forma JSON do
> `@adatechnology/game-shapes` (primitivas, extrusões, tornos, grupos, peças nomeadas, materiais por id, LOD, instâncias) e desenhado pelo
> `@adatechnology/game-shapes-three`; nada de `new THREE.XGeometry` nem acumulador próprio em pacote novo. Falta uma primitiva ou um caso:
> acrescente no `game-shapes` (com teste de igualdade bit a bit contra o three) em vez de contornar no pacote. Código portado das equipes
> continua lendo como o original: o kit do pacote passa o `shapeGeometries(THREE)` como `T`. Ao migrar um pacote, os goldens de cena dele
> não mudam nem um byte; o que não bater exatamente fica no caminho antigo e entra na lista da spec T9.

## 10. Slices

| Slice | Content | Gate beyond the common gates |
|---|---|---|
| (a) | `game-shapes`: types, JSON Schema + validator, three-exact math, generators (box, cylinder, cone, sphere, plane, circle, ring, lathe, torus, extrude, difference, mesh, point, custom), `generate` with parts, ranges, points, materials, colours, LOD, instancing, `buildPrimitive`, `mergeTransformed`, hash | bitwise equality against three r160 for every kind and a grid of parameters |
| (b) | `game-shapes-three`: `toGeometry`, `shapeGeometries`, `toObject3D`, `createMaterials`, `mergeByMaterial` | the props3d merge tests and the items `mergeItem` output equal before and after |
| (c) | `tools/shapes-bench` + CI job + baseline (numbers of the old paths) | `--check` passes on the baseline machine; a deliberate 2× slowdown fails it |
| (d) | worker pool and cache | worker result byte-equal to in-thread; cache hit equal to miss; in-flight dedupe |
| (e) | props3d → interactables-three → items-three | §7.1 for each, bench before/after |

## 11. Open questions for the owner

1. **Exact or improved?** The migrations reproduce today's geometry bit for bit, including its quirks (the interactables leaf and the floorplan
   leaf are different meshes; a cone in the floorplan is a 0.3→0.5 open cylinder). Do we keep that forever, or do we allow a later, deliberate
   "geometry v2" with re-recorded goldens (for example to share one leaf and one cylinder kit-wide, or to drop hidden faces)?
2. **Workers in the game.** Moving generation to workers changes load from synchronous to asynchronous. Do the game and the test room accept a
   loading step (promise per house / per street), or should the kit keep a synchronous path as the default and offer workers as an option?
3. **three r128 packages.** Urban, vegetation and vehicles tests still run three 0.128 because their team pages did. Lathe and extrusions differ
   between r128 and r160. Do we (a) add an `r128` variant of those two generators to `game-shapes`, (b) move those packages' tests to r160 and
   re-record their goldens once, or (c) leave lathes and extrusions of those packages on three?
4. **Booleans.** Only "box minus through-holes" is cheap and exact. Is that enough (walls, windows, doors, shelves), or do you want real CSG
   (holes at an angle, cuts in curved pieces) at the cost of a dependency and non-exact output?
5. **Bench budget.** A 50 % regression budget per builder against a calibration loop is the proposal. Do you want a tighter budget for the hot
   builders (houses, vehicles), and should the bench also guard memory (bytes per shape)?
6. **Where the schemas live.** The first migrations generate the schema in code from the existing builders. Should content packs also ship
   schemas as JSON files (so a game can edit a sofa without code), and if so, is a JSON file per item the format you want in the content packages?

## References

- `CLAUDE.md` §1–§4; `packages/game-props3d/README.md`; `packages/game-interactables-three/src/mesh.ts`; `packages/game-items-three/src/kit.ts`;
  `tools/golden/src/scene-hash.ts`; `tools/golden/README.md` (Node versions and `portablePow`).
- three r160 sources used for the ports: `src/geometries/{Box,Cylinder,Cone,Sphere,Plane,Circle,Ring,Lathe,Torus,Extrude}Geometry.js`,
  `src/extras/{Earcut,ShapeUtils}.js`, `src/math/{Matrix3,Matrix4,Quaternion,Vector3,Color,ColorManagement}.js`.
