# @adatechnology/game-destruction-three

three.js renderer for [`@adatechnology/game-destruction`](../game-destruction). The core decides what a hit does and reports it as events; this
package draws them on your meshes: vertex dents, bullet-hole and crack decals, char and heat glow, melting and puddles, fragments with light
physics, loose pieces after a part comes off, and pooled particles (fire, smoke, sparks, dust, shards, splinters, ...).

- Nothing is changed in place: geometry and materials are cloned on the first visual change of a mesh, and `restore` / `clear` give the originals back.
- Blasts and the fires of burning parts are drawn by the effects world of [`@adatechnology/game-vfx`](../game-vfx) (an `explode` event plays `ev.effect ?? 'generic'`, scaled by the radius when it names none). Pass the world the host shares in `vfx`; without it the renderer makes its own world and its own `game-vfx-three` layer and steps them in `update`. Debris, sparks, drips and leaks still use two pooled `THREE.Points` (additive and normal blending), with a soft sprite computed in the shader (no texture asset); they move to the shared sprite pool when `game-vfx` gets one.
- `three` is a peer dependency used for types only: you pass your own `THREE` instance at runtime.
- The renderer plays nothing: you get keys (`impact_metal`, `shatter_glass`, `burn_loop`, `burn_end`, ...) through `onSound`. `createDestructionSound(engine)` is the sound bank for them on a [`@adatechnology/game-audio`](../game-audio) engine: the Cena de Arte's material sounds (clang, wood, glass, crumble, thud, boom...) and the game's explosion thump, a fire loop that follows how many parts burn, and a key table (`style: 'art_scene' | 'game'`, `keys` to replace) so a game changes what each key plays. An impact, a break or a ricochet also sends `detail.keys`, the keys to try first, most specific first: `impact_<material>_<blow>`, `impact_<material>`, `impact_<family>_<blow>`, `impact_<family>` (`blow` is the hit's `DamageType`, carried by every destruction event as `blow`; the family comes from `impactFamily`: metal, glass, ceramic, soil, masonry, wood, plant, plastic, rubber, wax, soft). `IMPACT_SOUND_KEYS` gives a bullet, a blow and a blade their own sound on each family; a game replaces or silences any key in `keys`.

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

For picking, `bind` and the loose pieces write back to the meshes: every mesh of a part has `userData.destructionPart` (the part id) and
`userData.destructionObject` (the id of the world object the part belongs to now; a loose piece made by `splitGroup` has an id of its own, the same one
`renderer.piece(id)` and `world.state(id)` use), also on the mesh a vertex-range part gets when it leaves a merged mesh. A raycast hit goes to
`world.hitPart(hit.object.userData.destructionObject, hit.object.userData.destructionPart, ...)`. Purely visual meshes (fracture fragments, decals, ground
stains) have `userData.destructionDebris = true`: skip them when picking. Parts drawn by a range of a merged mesh share it, so the merged mesh itself carries no part id.

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
| `crack` | star of jagged white lines on glass (transparent materials) only; an opaque body draws no lines, its damage shows as chips, holes and dents | `impact_*` |
| `ricochet` | sparks along the reflected direction | `ricochet` |
| `debris` | a burst of the requested kind (`sparks`, `dust`, `shards`, `splinters`, `chips`, `fibers`, `leaves`, `drips`, `ash`, `smoke`, `steam`) | |
| `fracture` | part hidden; fragments (boxes, thin irregular prisms for shards; by the material's `splitForm`: pointed frayed slivers for wood splinters, a torn end on the stub of a broken board, irregular lumps for MDF, ragged veneer for plywood sheets) with gravity, ground bounce, settling, sleep and shrink-away; debris burst by style | `shatter_glass`, `crumble`, `splinter`, `impact_*` |
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

`settle` (an object with `DestructibleSpec.soil` settled or tilted): on the first one the renderer moves the children of the bound root under a group named
`destruction-soil` and gives it `ObjectState.soil.offset`, updated every frame while the soil yields; the root keeps the host's pose, which is what
`syncTransform` keeps sending to the world.

`world.explode` emits no event of its own (only a part with `explodes` does), so a host that detonates a grenade or rocket calls `renderer.explode(point, energy, radius)` next to it to get the same flash, fire, smoke, light, sound and shove.

Round pieces roll and knock each other. A piece whose drawing is round about one axis (a can, a bottle) or all three (a ball) rolls on the lowest point of each ring of its
profile (`PieceRound.profile`: a straight can rolls straight, a tapered bottle rounds its narrow end), with I = k m r^2 about its axis: hollow walls of known thickness
(`userData.hollow`, `userData.destructionThickness`) weigh as a thin shell (k 1), the rest of the mass as a solid (k 1/2), or `makePiece(id, { inertia })` says k. Down a slope
of angle t it rolls at g (sin t - C_rr cos t) / (1 + k), C_rr the rolling resistance of the softer surface (`friction.ts`). Pieces meet each other when one of them is round:
a capsule round its axis against the other's capsule or the boxes of its parts, and they trade an impulse with the restitution of their two materials (geometric mean),
momentum kept; candidates come from a sweep and prune along x, and an update is split into steps while a round piece moves fast enough to pass through another. Against what
is not a piece (a wall, a table's leg) a piece bounces by the restitution of the two materials (`PieceSweepHit.restitution`).

Pieces report hard landings: above 3 m/s the renderer calls `world.hit(id, { type: 'blunt', energy: 0.5 m v^2, radius: 0.08, direction: [0, -1, 0], source: 'fall' })`
(throttled to once per 0.15 s per piece; the object's transform is synced to the world first, so the hit lands on the right spot), so a dropped glass
pane shatters and a thrown chair can lose a leg. `Piece.localCenter` is the centre of mass relative to the root origin (it moves when a part breaks off).

## Performance

| Budget | `medium` / `high` | `low` |
|---|---|---|
| Particles (`maxParticles`) | 2500 | 1250 |
| Particle burst counts | 100 % | 60 % |
| Fragment meshes (`maxFragments`) | 160 | 80, and every second fragment of an event is skipped |
| Loose pieces simulated at once (`maxAwakePieces`) | no limit (suggested 24) | no limit (suggested 24) |
| Fragments moving at once (`maxAwakeFragments`) | no limit (suggested 64) | no limit (suggested 64) |
| Vertex dents / melt noise on meshes over 20k vertices | yes | skipped |

- Particles are two fixed-size ring buffers (additive 40 %, normal 60 %), one draw call each; dead particles cost a loop iteration, nothing else.
- Fragments share one box geometry, six shard geometries, six of each wood shape (sliver, broken board, MDF lump, plywood veneer; 20 to 100 triangles each) and one material per source material id and colour; they shrink away instead of fading.
- Decals share one disc geometry and one material; a mesh keeps at most 48 and the renderer 600.
- Heat, char and melt are only read for "active" parts (hot, burning, melting) plus a scan of all parts every 0.4 s.
- The first renderer runs one blast on a small wall off screen, once per engine (`jitWarmUp`, on by default, about 0.4 s at load), so the first real explosion does not run cold (it cost about twice the later ones). A host on an engine passes the engine it made its world from, `jitWarmUp: { engine }`, or only the kit's own solver and the shared code are warmed; `false` turns it off. A warm-up that fails is skipped with one warning: the game starts without it.
- The explosion light is created on the first explosion (one light in the scene afterwards, intensity 0 at rest) so plan for the one-time shader recompile.
- Melt assumes upright meshes (it scales the mesh along its own Y).
- Debris at rest can cost no simulation and few draws; both are opt-in, so a host that sets nothing simulates and draws exactly as before. Over `maxAwakePieces`
  (`maxAwakeFragments`) the oldest that have come to rest (on the ground, slower than a piece that sleeps; one held up at an angle once it kept its tilt for 1.5 s) sleep where
  they lie, nothing moved. A piece put to sleep so keeps the points it lies on and wakes when any of them loses its support, so nothing is left in the air. With
  `settledBatches` the debris asleep is drawn in batches, one draw per material (made with `createStaticBatcher` of `@adatechnology/game-render-three` from 16 meshes outside a
  batch, at most once a second; copies of one material with equal settings share a batch): its collision is the piece's, unchanged, and a piece that is woken, hit, dented,
  hidden or touched by any event of its object draws on its own again at once. Transparent debris (glass), the meshes of an object burning or charring and meshes over 4000
  vertices draw on their own. `settledBatchStats()` reports the batches. The test room turns the batches on; its awake budget stays off unless
  `debris.maxAwakePieces` / `maxAwakeFragments` are given (`SUGGESTED_MAX_AWAKE_PIECES`, `SUGGESTED_MAX_AWAKE_FRAGMENTS`).

### The explosion's work in a frame budget (`workBudget`, opt-in)

Left out, the work a blow leaves (loose groups to cut into pieces, fragments to spawn) is cut by the clock (`eventBudgetMs`, or a shared frame budget's deadline), as before.
With `workBudget: {}` it is cut by a budget of **work units**, never of time (spec 008, `design/orcamento-da-explosao.md`, evidence T3.8aa): one arbiter (`WorkBudget` of
`game-physics`) that the events, the splits, the fragments and the blast's wake queue draw from, in that order. The events still apply in their frame (flash, dust, cracks,
the part hidden), and each is charged `perEvent`. Each loose group joins a queue (`WorkQueue`, data only), ranked by its distance to `focus` (read once, when it came loose),
then by its smallest part id, and charged by the size of its work (`splitWorkUnits`: as if none of its boxes were fitted ahead, so the schedule never depends on a cache).
Until its turn the group stays in its object, drawn and solid where it stood; none stands loose more than `maxWaitFrames` frames (a group loosened in frame F is a piece by
F + 12), and the queue moves one a frame at least. The first split an event makes in a frame always runs in it, over the budget if need be. No clock is read: the same session
cuts the same pieces in the same frames on every machine of the same `tier`. With the blast's wake queue on, set `debrisCost: { source: 'fixed' }` too, or its batches still
follow the measured step.

**Registering with a frame budget brings the clock back.** When `deferredQueue()` is registered with a game-runtime `FrameBudget`, that budget's clock decides in which frames
the work step runs at all, so the frames the pieces are cut in follow the machine again: determinism holds only with the queue left unregistered (the renderer drains it in
its own `update`).

The split queue is not part of a save. After a load, an object bound (`bind`) or drawn again (`redraw`) with more than one group has its loose groups queued in the next work
step, so none stays loose in its object; a queued group whose parts were shattered meanwhile still splits by the parts it has left, and one whose parts are no longer loose
gives its place to the object's loose groups as they are then. `unbind`, `release` and `releasePieces` drop the object's waiting groups. Without `workBudget` the same holds:
an object bound or drawn again with loose groups (a house built with loose poles, a mailbox, a door whose wall was taken out) has them split into pieces in the next `update`
or drain, where they stood, before any event touches it (`autoSplit: false` leaves them in the object). Every option must be a finite number,
or `WorkBudgetOptionError` (`WORK_BUDGET_OPTION`) is thrown.

| Option | Default | What it does |
|---|---|---|
| `budgetMs` | 4 (`DEFAULT_WORK_BUDGET_MS`) | Milliseconds of deferred work a frame may take on the reference machine |
| `unitsPerMs` | 100 (`DEFAULT_WORK_UNITS_PER_MS`) | Work units in a millisecond on the reference machine (the calibration of the costs below) |
| `tier` | 1 | How much slower than the reference this machine runs the same work, picked once per session: the frame holds `budgetMs × unitsPerMs / tier` units |
| `maxWaitFrames` | 12 (`DEFAULT_MAX_WAIT_FRAMES`, 0,2 s) | Frames a loose group stands loose at most, whatever the budget: it splits by the `maxWaitFrames`-th work step after it came loose |
| `costs` | `WORK_UNIT_DEFAULTS`: `perSplit` 120, `perVertex` 0.05, `perHostVertex` 0.01, `perObjectPart` 0.3, `perFragment` 4, `perEvent` 40, `perWake` 2 | Units per unit of work; the first calibration (T3.8aa), to be measured again on top of the fits ahead, the batched bodies and the ground budget |

### Debris of a blast (`blastDebris`, opt-in)

Left out, a blast shoves, wakes and loosens everything in its own frame, as before. With `blastDebris: {}` (or any of the numbers) the renderer keeps the cost of a blast
bounded. **Every number is an option** (per renderer in `RendererOptions.blastDebris`; per blast in `ExplodeOptions.debris`, which wins, for what belongs to one blast:
`maxWakeDelay`, `minPhysicsPieces`, `maxPhysicsPieces`, `physicsCostTargetMs`, `chipSize`; `BLAST_DEBRIS_DEFAULTS` is the default), measured on "Intel Core Ultra 9 275HX, 24 cores, Node 20" (spec 008, `evidence.md` T3.6d). Nothing adapts by GPU vendor, only by the cost measured on the machine
(`PhysicsFrame.stepMs` over the world's awake bodies, smoothed).

| Option | Default | What it does |
|---|---|---|
| `debrisCost` (renderer option) | `{ source: 'measured' }` | Where the step cost above comes from. `measured` reads the loop's wall-clock step time (`PhysicsFrame.stepMs`): batch sizes and piece counts then depend on the machine, so two machines (or a replay) diverge; `record` collects each frame's sample. `{ source: 'fixed' }` never reads the clock: batches and counts come only from the numbers in this table, the same on every machine (tests, lockstep). `{ source: 'replay', samples }` plays a recorded list frame by frame instead of the clock. |
| `wakeCostTargetMs` | 4 | The physics step may reach this as debris wakes: each frame wakes as many (nearest `focus` first, else the blast's centre) as the cost of the frames before leaves room for. Nothing is timed per body |
| `maxWakeDelay` | 0.08 s | A piece waits at most this to wake, whatever the cost |
| `maxQueuedWakes` | 2048 | Pieces waiting to wake at most; the farthest over it wake at once |
| `minWakesPerFrame` | 8 | Woken every frame at least, so a queue behind a heavy frame drains |
| `minPhysicsPieces` / `maxPhysicsPieces` | 24 / 300 | Pieces of one blast that enter physics: `physicsCostTargetMs / wake cost per body - bodies already awake`, clamped between them (250 on the measured machine); the big ones first, nearest the player first |
| `physicsCostTargetMs` | 5 | Milliseconds of step a blast's debris may add in the frame it wakes (sets the count above, at the wake cost per body) |
| `wakeCostPerBodyMs` | 0.02 | Cost of one body in the frame a pile wakes in until measured (a woken island costs ~9 times what it costs settled) |
| `physicsCostPerBodyMs` | 0.0022 | Cost of one awake body until the world has been measured |
| `chipSize` | 0.15 m | Longest side under which a loosened object is a chip: it goes after every big one when the count is full. A piece left out stays where it stands (drawn, solid: nothing invisible collides) and the blast throws visual chips (`vfx`, no collision) there |
| `maxLivePieces` | 600 | Pieces alive at once (asleep or not): over it the far and old ones at rest fade first, then the oldest |
| `far.distance` / `far.age` | 40 m / 30 s | A piece at rest farther than this from `focus` and older than this is far and old |
| `far.action` | `'sleep'` | `'sleep'` or `'fade'`. `'fade'` removes the body and collider and shrinks the root over `far.fadeSeconds` (0.5), then `onDebrisFaded(id, root)` hands it to the host to dispose. Merged drawing of debris at rest is `settledBatches` |

The world's own solver passes are `WorldDesc.velocityIterations` (default 32 in `KIT_WORLD`, the least that keeps a 20:1 mass stack from making energy).

## API

```ts
createDestructionRenderer(THREE, options: RendererOptions): DestructionRenderer
specFromObject3D(THREE, root, options?: SpecFromObjectOptions): { spec, parts }
heatColor(temperatureC: number): number // 0xRRGGBB, 0 below ~450 C, dark red ~500, orange ~800, yellow ~1100, white from 1400
```

`RendererOptions`: `scene`, `world`, `quality`, `maxFragments`, `maxAwakePieces`, `maxAwakeFragments`, `settledBatches`, `blastDebris`, `workBudget`, `focus`, `onDebrisFaded`, `maxParticles`, `fragmentLife`, `groundAt`, `terrainAt` (the terrain alone, what an engine stands pieces on: every drawn fixed thing is a body of its own there), `gravity`, `autoSplit`, `onPiece`, `onSound`,
`vfx` (shared effects world), `camera` (of the own world, when `vfx` is not given), `pointScale` (point size in pixels per metre at 1 m; about `viewportHeight / (2 tan(fov / 2))`, default 700).

How long debris stays: `fragmentLife` is the seconds a resting fragment stays before it shrinks away (default 12, `0` = forever), or a `FragmentLifeRule`
`(fragment, objectId) => seconds` that decides per fragment from its `material`, `size` and `shape` and the object it came from, e.g. rubble that stays and chips that go:
`fragmentLife: (f) => (Math.max(...f.size) > 0.1 ? 0 : f.material === 'glass' ? 30 : 12)`. `maxFragments` caps how many live at once (the oldest fades first).
Loose pieces (a door, a leg, a slab that breaks off whole) never fade: they stay in the map with collision. Dust, smoke and chip sprites have the life of their kind
in `@adatechnology/game-vfx` (`patchSpriteKinds(SPRITE_KINDS, { dust: { life: [10, 30] } })` on the effects world).

`DestructionRenderer`: `bind`, `unbind`, `makePiece`, `pieces`, `piece`, `impulse`, `update`, `emit`, `explode(point, energy, radius, { effect?, direction?, visual? })` (`visual: false` keeps only the shove and the sound, for a host that played the effect itself), `clear`, `restore`, `stats`, `dispose`.
`clear()` removes fragments, decals, puddles and particles from the scene and restores every bound mesh; `dispose()` also unsubscribes from the world.

## Português

Renderizador three.js para o `@adatechnology/game-destruction`. O núcleo decide o que cada golpe faz e devolve eventos; este pacote desenha: amassados
nos vértices, furos de bala e rachaduras, carbonização e brilho de calor, derretimento e poças, fragmentos com física leve, peças soltas e partículas
em pool (fogo, fumaça, faíscas, poeira, cacos, lascas). Geometria e materiais só são clonados na primeira mudança visual de uma malha, e `restore` /
`clear` devolvem os originais. O renderer não toca nada: o jogo recebe chaves (`impact_metal`, `shatter_glass`, `burn_loop`, `burn_end`, ...) em `onSound`; `createDestructionSound(engine)` é o banco de sons delas no `game-audio` (sons dos materiais da Cena de Arte, o estouro do jogo, o laço de fogo e a tabela chave → som, trocável).

Uso: `specFromObject3D(THREE, modelo)` gera a especificação e o mapa parte -> malhas; registre no mundo com `world.add(spec)`, ligue com
`renderer.bind(id, modelo, { parts })` e chame `world.update(dt)` e `renderer.update(dt)` a cada quadro. Com `quality: 'low'` os orçamentos de
partículas e fragmentos caem pela metade.
