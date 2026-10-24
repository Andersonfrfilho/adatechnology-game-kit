# @adatechnology/game-destruction-three

three.js renderer for [`@adatechnology/game-destruction`](../game-destruction). The core decides what a hit does and reports it as events; this
package draws them on your meshes: vertex dents, bullet-hole and crack decals, char and heat glow, melting and puddles, fragments with light
physics, loose pieces after a part comes off, and pooled particles (fire, smoke, sparks, dust, shards, splinters, ...).

- Nothing is changed in place: geometry and materials are cloned on the first visual change of a mesh, and `restore` / `clear` give the originals back.
- Two pooled `THREE.Points` (additive and normal blending) draw every particle, with a soft sprite computed in the shader (no texture asset).
- `three` is a peer dependency used for types only: you pass your own `THREE` instance at runtime.
- Sounds are not played: you get keys (`impact_metal`, `shatter_glass`, ...) through `onSound`.

Contracts live in [`@adatechnology/game-contracts`](../game-contracts); the types are re-exported here, so existing imports keep working.

## Install

```sh
pnpm add @adatechnology/game-destruction-three @adatechnology/game-destruction three
```

Browser without a bundler (the global is `GameDestructionThree`; it bundles the core, so you only need three.js and this file):

```html
<script src="https://unpkg.com/@adatechnology/game-destruction-three/dist/index.global.js"></script>
<script>
  const { spec, parts } = GameDestructionThree.specFromObject3D(THREE, model)
</script>
```

## Usage

```ts
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer, specFromObject3D } from '@adatechnology/game-destruction-three'

const scene = new THREE.Scene()
const world = createDestruction({ seed: 7 })
const renderer = createDestructionRenderer(THREE, {
  scene,
  world,
  quality: 'medium',
  groundAt: (x, z) => terrain.heightAt(x, z), // default: flat at y = 0
  onPiece: (piece) => grabbable.push(piece),
  onSound: (key, point, volume) => audio.play(key, point, volume),
})

// 1. describe a model: one part per mesh, materials guessed from names, joints inferred from touching parts
scene.add(chairModel)
const { spec, parts } = specFromObject3D(THREE, chairModel, { name: 'chair', anchorBelow: 0.01 })

// 2. register it in the world and bind it to the model (the world follows chairModel's transform)
const id = world.add(spec, { position: [2, 0, -3] })
renderer.bind(id, chairModel, { parts })

// 3. hit it, burn it, take it apart
world.shoot([0, 1.5, 0], [0, 0, -1], 2500, 9)
world.hit(id, { type: 'fire', point: [2, 0.4, -3], temperature: 900, radius: 0.3, duration: 0.2 })

// 4. every frame
function frame(dt: number) {
  world.update(dt)
  renderer.update(dt)
}

// make a bound object a thrown prop
const piece = renderer.makePiece(id, { mass: 6 })
renderer.impulse(id, [0, 40, -120], [2, 0.6, -3])
```

`bind` finds the meshes of each part from `options.parts` (what `specFromObject3D` returns), else from `userData.destructionPart` or a mesh name that
equals a part id, else by the part box that contains the mesh centre. `specFromObject3D` reads `userData.destructionMaterial`,
`destructionPart` (a part id, or `{ id, material?, parent?, kind? }`: `parent` + `kind` attach the part to its parent with a joint of that kind), `destructionIgnore`, `destructionTags` and `hollow`.

### Parts of a merged mesh

A building or a baked model often has one merged mesh for many parts. Bind each part by the vertex range it occupies (`{ mesh, range: [v0, v1] }`,
end exclusive; a part value can also be an array mixing meshes and ranges):

```js
renderer.bind(houseId, houseRoot, { parts: {
  wall_north: { mesh: merged, range: [0, 1280] },
  wall_south: { mesh: merged, range: [1280, 2610] },
  door: doorMesh,                      // plain meshes still work
} })
```

For indexed geometry the faces whose three vertices all lie in the range belong to the part; for non-indexed geometry the range is the part's
triangles. Dents move only the range's vertices; char and heat go to the range's vertex colours (the mesh gets a `color` attribute, and a cloned
material with `vertexColors`, when it has none); hole and crack decals stay on the part; melt squashes and widens only the range. When the part
detaches or collapses (`detach` and `collapse` events), its faces are copied, with their dents and colours and the merged mesh's transform and
material, into a new mesh that becomes the loose piece, and the range is collapsed to a point in the merged mesh so it vanishes there. A broken,
melted or burnt-out part vanishes the same way. `restore` and `clear` put the merged mesh's original geometry and material back and remove the
loose meshes. An invalid range (outside the geometry or empty) throws from `bind`.

## What each event draws

| Event | Visual | Sound key |
|---|---|---|
| `dent` | vertices within `dent.radius` pushed in by `depth * (1 - (d/r)^2)^2` (skipped on `low` for meshes over 20k vertices); sparks on metal | `impact_*` |
| `hole` | dark disc decal on the surface (and on the exit side of a through hole); a crack star on transparent materials; sparks on metal | `impact_*` |
| `crack` | star of jagged lines, white on glass, dark otherwise | `impact_*` |
| `ricochet` | sparks along the reflected direction | `ricochet` |
| `debris` | a burst of the requested kind (`sparks`, `dust`, `shards`, `splinters`, `chips`, `fibers`, `leaves`, `drips`, `ash`, `smoke`, `steam`) | |
| `fracture` | part hidden; fragments (boxes, thin irregular prisms for shards) with gravity, ground bounce, settling, sleep and shrink-away; debris burst by style | `shatter_glass`, `crumble`, `splinter`, `impact_*` |
| `spall` | opaque patch (disc decal) in the colour of the part's core material where a coat came off, under the holes; sits on the face of the mesh the point is nearest to (the thin axis of its world box) | |
| `stage` (2, with `fragments`) | the unit-sized fragments of the breach fly out with the same physics as `fracture` fragments, the holes of `Fragment.marks` ride on them as dark discs, a dust burst; the part stays drawn (cutting the opening in its faces is left to the house renderer) | `crumble`, `impact_*` |
| `expose` | the bars as instanced cylinders (radius 4 mm), one mesh per part, replaced by each new `expose`; empty `bars` removes the cage; `renderer.rebarCount()` | |
| `detach` | with `autoSplit`, each loose group becomes its own `Group` (world transforms kept) and a `Piece` (`onPiece`) | `detach` |
| `disassemble_progress` | | `unscrew` (throttled) |
| `ignite` / `extinguish` / `burnout` | fire and smoke from the surface while `part.burning`; steam when put out; ash at burnout; char lerps the colour to the material `charColor`; status `ashes` hides the part and leaves an ash pile | `ignite`, `burn_loop`, `extinguish` |
| heat (`damage` of type heat/fire, or any hot glowing part) | emissive `heatColor(temperature)` for materials with `visual.glows` | |
| `melt` | meshes sag (Y down to 25 %, a bit wider, noisy vertices, bottom stays put); status `melted` hides the part and leaves a puddle | `melt_sizzle` |
| `drip` | falling drop that leaves a flat puddle (merged, capped) | |
| `leak` | stream of drops (or a faint puff for gas) from the hole while the part still has liters | |
| `explode` | flash, fire, smoke, dust and sparks, a pooled `PointLight` pulse, impulses on pieces and fragments in range | `explode` |

`world.explode` emits no event of its own (only a part with `explodes` does), so a host that detonates a grenade or rocket calls `renderer.explode(point, energy, radius)` next to it to get the same flash, fire, smoke, light, sound and shove.

Pieces report hard landings: above 3 m/s the renderer calls `world.hit(id, { type: 'blunt', energy: 0.5 m v^2, radius: 0.08, direction: [0, -1, 0], source: 'fall' })`
(throttled to once per 0.15 s per piece; the object's transform is synced to the world first, so the hit lands on the right spot), so a dropped glass
pane shatters and a thrown chair can lose a leg. `Piece.localCenter` is the centre of mass relative to the root origin (it moves when a part breaks off).

## Performance

| Budget | `medium` / `high` | `low` |
|---|---|---|
| Particles (`maxParticles`) | 2500 | 1250 |
| Particle burst counts | 100 % | 60 % |
| Fragment meshes (`maxFragments`) | 160 | 80, and every second fragment of an event is skipped |
| Vertex dents / melt noise on meshes over 20k vertices | yes | skipped |

- Particles are two fixed-size ring buffers (additive 40 %, normal 60 %), one draw call each; dead particles cost a loop iteration, nothing else.
- Fragments share one box geometry, six shard geometries and one material per source material id and colour; they shrink away instead of fading.
- Decals share one disc geometry and one material; a mesh keeps at most 48 and the renderer 600.
- Heat, char and melt are only read for "active" parts (hot, burning, melting) plus a scan of all parts every 0.4 s.
- The explosion light is created on the first explosion (one light in the scene afterwards, intensity 0 at rest) so plan for the one-time shader recompile.
- Melt assumes upright meshes (it scales the mesh along its own Y).

## API

```ts
createDestructionRenderer(THREE, options: RendererOptions): DestructionRenderer
specFromObject3D(THREE, root, options?: SpecFromObjectOptions): { spec, parts }
heatColor(temperatureC: number): number // 0xRRGGBB, 0 below ~450 C, dark red ~500, orange ~800, yellow ~1100, white from 1400
```

`RendererOptions`: `scene`, `world`, `quality`, `maxFragments`, `maxParticles`, `fragmentLife`, `groundAt`, `gravity`, `autoSplit`, `onPiece`, `onSound`,
`explosionLight`, `pointScale` (point size in pixels per metre at 1 m; about `viewportHeight / (2 tan(fov / 2))`, default 700).

`DestructionRenderer`: `bind`, `unbind`, `makePiece`, `pieces`, `piece`, `impulse`, `update`, `emit`, `explode`, `clear`, `restore`, `stats`, `dispose`.
`clear()` removes fragments, decals, puddles and particles from the scene and restores every bound mesh; `dispose()` also unsubscribes from the world.

## Português

Renderizador three.js para o `@adatechnology/game-destruction`. O núcleo decide o que cada golpe faz e devolve eventos; este pacote desenha: amassados
nos vértices, furos de bala e rachaduras, carbonização e brilho de calor, derretimento e poças, fragmentos com física leve, peças soltas e partículas
em pool (fogo, fumaça, faíscas, poeira, cacos, lascas). Geometria e materiais só são clonados na primeira mudança visual de uma malha, e `restore` /
`clear` devolvem os originais. Os sons não são tocados: o jogo recebe chaves (`impact_metal`, `shatter_glass`, ...) em `onSound`.

Uso: `specFromObject3D(THREE, modelo)` gera a especificação e o mapa parte -> malhas; registre no mundo com `world.add(spec)`, ligue com
`renderer.bind(id, modelo, { parts })` e chame `world.update(dt)` e `renderer.update(dt)` a cada quadro. Com `quality: 'low'` os orçamentos de
partículas e fragmentos caem pela metade.
