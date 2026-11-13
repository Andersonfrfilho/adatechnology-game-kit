import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { Fragment, SplitForm } from '@adatechnology/game-destruction'

import { pushFittedBoxes } from './fitted-boxes'
import { FRAGMENT_SHAPE_VARIANTS, buildBrokenBoardGeometry, buildLumpGeometry, buildRubbleGeometry, buildSliverGeometry, buildVeneerGeometry } from './fragment-shapes'
import { clamp, createRng, hashString } from './math'
import type { LooseBody } from './types'

interface Live {
  mesh: THREE_NS.Mesh
  /** The surface under the fragment (ground or what is built), and where it was measured: measured again once the fragment moves off that spot. */
  floor: { x: number; z: number; y: number } | null
  home: string
  vel: THREE_NS.Vector3
  ang: THREE_NS.Vector3
  half: THREE_NS.Vector3
  baseScale: THREE_NS.Vector3
  still: number
  asleep: boolean
  /** It touched what is under it in its last step. */
  contact: boolean
  /** Seconds at rest. */
  rest: number
  /** 1 while alive; counts down to 0 while shrinking away. */
  fade: number
  dying: boolean
  /** Air drag per second: a loose sheet (a page) glides and flutters down instead of dropping. */
  air: number
  /** A big one (`isBig`): it stays where it lies, and what walks steps on it or kicks it. */
  body: LooseBody | null
  /** The `update` count when it was made. */
  born: number
  /** Seconds it stays at rest before it fades (0 = forever). */
  life: number
  /** Its box in the world while it rests, for what lands on it (`pileUnder`); dropped when it wakes. */
  box?: RestingBox | undefined
}

interface RestingBox {
  readonly x: number
  readonly z: number
  readonly reachX: number
  readonly reachZ: number
  readonly top: number
}

/** The rotation of a unit quaternion as a column-major 4×4 array, like `Matrix4.elements`. */
function rotationOf(q: THREE_NS.Quaternion): readonly number[] {
  const { x, y, z, w } = q
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
  ]
}

/** The world box of a resting fragment: its centre, how far it reaches along x and z, and its top. */
function restingBox(f: Live): RestingBox {
  const e = rotationOf(f.mesh.quaternion)
  const { x, y, z } = f.half
  const p = f.mesh.position
  return {
    x: p.x,
    z: p.z,
    reachX: Math.abs(e[0]) * x + Math.abs(e[4]) * y + Math.abs(e[8]) * z,
    reachZ: Math.abs(e[2]) * x + Math.abs(e[6]) * y + Math.abs(e[10]) * z,
    top: p.y + Math.abs(e[1]) * x + Math.abs(e[5]) * y + Math.abs(e[9]) * z,
  }
}

/** What a fragment's resting time can depend on: the fragment (its material, size, shape) and the id of the object it came from. */
export type FragmentLifeRule = (fragment: Fragment, objectId: string) => number

export interface FragmentSystemOptions {
  scene: THREE_NS.Scene
  groundAt: (x: number, z: number) => number
  gravity: number
  max: number
  /** Seconds a resting fragment stays before it fades (0 = forever), or a rule that gives it per fragment. */
  life: number | FragmentLifeRule
  /** How a material comes apart (`MaterialDef.splitForm`): MDF lumps and plywood veneer get shapes of their own. Default: none. */
  formOf?: (materialId: string) => SplitForm | undefined
  /**
   * The top of whatever is under (x, z) below height y: the ground, or a slab, a wall, a piece of furniture a piece of rubble lands on. Default: the
   * ground (`groundAt`).
   */
  surfaceAt?: (x: number, y: number, z: number) => number
  /** Whether a material crumbles (`MaterialDef.fracture` 'crumble': brick, block, concrete, plaster): its chunks are drawn broken, not as cut boxes. */
  crumbles?: (materialId: string) => boolean
  /**
   * Most fragments moving at once. Over it, the oldest that lie on what is under them and are as slow as one that settles (`isSlow`) are put to sleep where they lie at once,
   * instead of after `SETTLE_SECONDS`. Default: no limit.
   */
  maxAwake?: number
}

const BUILDERS: Record<Exclude<SharedShape, 'shard'>, (THREE: typeof THREE_NS, seed: number) => THREE_NS.BufferGeometry> = {
  sliver: buildSliverGeometry,
  lump: buildLumpGeometry,
  veneer: buildVeneerGeometry,
  board: buildBrokenBoardGeometry,
  rubble: buildRubbleGeometry,
}

/** The shared shapes a fragment can take besides the box: glass shards, wood splinters, MDF lumps, plywood veneer and the torn stub of a broken board. */
type SharedShape = 'shard' | 'sliver' | 'lump' | 'veneer' | 'board' | 'rubble'

/** How far (m) a fragment moves before what is under it is measured again. */
const FLOOR_REMEASURE = 0.5
/** Thickest scrap that flies as a sheet (m), its air drag (1/s) and how hard it sways (m/s²). */
const SHEET_MAX = 0.004
const SHEET_AIR = 2.5
const SHEET_SWAY = 3
/** A fragment at least this long (m) and this wide is a piece of the thing (half a board), not a splinter; a shard of glass never is. */
const BIG_LENGTH = 0.2
const BIG_WIDTH = 0.03
/** The seed of the fragments' random stream (their spin and sway); `reset` takes it back here. */
const FRAGMENT_SEED = 0x51ed270b

/** Fragments asleep whose ground is looked at again each update, in turn, and how far (m) over it one may lie before it falls: the table it lay on broke. */
const SUPPORT_CHECKS = 32
const SUPPORT_GAP = 0.02
/** How far (m) above a falling fragment's bottom a resting top may be and still be what it lands on: a step it slides up onto rather than sinks into. */
const PILE_STEP = 0.01

/** How many shard shapes there are; a fragment takes one by the hash of its id. */
const SHARD_SHAPES = 6

/** Seconds a fragment stays slow on what is under it before it sleeps. */
const SETTLE_SECONDS = 0.4

/** As slow as a fragment that settles: under about 0.11 m/s and 0.45 rad/s. */
const isSlow = (f: Live): boolean => f.vel.lengthSq() < 0.012 && f.ang.lengthSq() < 0.2

const isBig = (size: readonly number[]): boolean => {
  const [, middle, longest] = [...size].sort((a, b) => a - b)
  return longest >= BIG_LENGTH && middle >= BIG_WIDTH
}

/** Light physics for fracture debris: gravity, ground bounce and friction, spin damping, settling flat, sleep, shrink-away and removal. */
export class FragmentSystem {
  private readonly list: Live[] = []
  private readonly box: THREE_NS.BoxGeometry
  /** The mesh box of a fragment before its scale. */
  private readonly unitBox = { min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } }
  private shardGeos: THREE_NS.BufferGeometry[] = []
  private readonly shapeGeos = new Map<Exclude<SharedShape, 'shard'>, THREE_NS.BufferGeometry[]>()
  private readonly materials = new Map<string, THREE_NS.Material>()
  private readonly q: THREE_NS.Quaternion
  private readonly dq: THREE_NS.Quaternion
  private readonly m: THREE_NS.Matrix4
  private readonly v: THREE_NS.Vector3
  private readonly w: THREE_NS.Vector3
  private rng = createRng(FRAGMENT_SEED)
  /** Count of `update` calls: what makes the fragments of one burst tell apart from older ones. */
  private tick = 0
  private supportTurn = 0

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly o: FragmentSystemOptions,
  ) {
    this.box = new THREE.BoxGeometry(1, 1, 1)
    this.q = new THREE.Quaternion()
    this.dq = new THREE.Quaternion()
    this.m = new THREE.Matrix4()
    this.v = new THREE.Vector3()
    this.w = new THREE.Vector3()
  }

  get count(): number {
    return this.list.length
  }

  /** Meshes of every live fragment (tests and picking). */
  meshes(): THREE_NS.Mesh[] {
    return this.list.map((f) => f.mesh)
  }

  /** Meshes of the fragments asleep in the scene, without marks on them (a mark is a mesh of its own on the fragment). */
  restingMeshes(): THREE_NS.Mesh[] {
    return this.list.filter((f) => f.asleep && !f.dying && f.mesh.children.length === 0 && f.mesh.parent === this.o.scene).map((f) => f.mesh)
  }

  /** One shared material per source material id + colour (+ transparency). */
  materialFor(materialId: string, color: number, transparent: boolean, opacity = 0.5): THREE_NS.Material {
    const key = `${materialId}:${color}:${transparent ? 1 : 0}`
    let m = this.materials.get(key)
    if (!m) {
      m = transparent
        ? new this.THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity, side: this.THREE.DoubleSide, depthWrite: false })
        : new this.THREE.MeshLambertMaterial({ color })
      this.materials.set(key, m)
    }
    return m
  }

  private shardGeometry(seed: number): THREE_NS.BufferGeometry {
    const idx = seed % SHARD_SHAPES
    let g = this.shardGeos[idx]
    if (!g) {
      const r = createRng(1000 + idx)
      const n = 3 + Math.floor(r() * 3) // triangle, quad or pentagon, irregular
      const shape = new this.THREE.Shape()
      const pts: Array<[number, number]> = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.7
        const rad = 0.35 + r() * 0.15
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad])
      }
      shape.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < n; i++) shape.lineTo(pts[i][0], pts[i][1])
      shape.closePath()
      g = new this.THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
      g.translate(0, 0, -0.5)
      this.shardGeos[idx] = g
    }
    return g
  }

  private sharedGeometry(shape: Exclude<SharedShape, 'shard'>, seed: number): THREE_NS.BufferGeometry {
    const idx = seed % FRAGMENT_SHAPE_VARIANTS
    let variants = this.shapeGeos.get(shape)
    if (!variants) {
      variants = []
      this.shapeGeos.set(shape, variants)
    }
    let g = variants[idx]
    if (!g) {
      g = BUILDERS[shape](this.THREE, idx)
      variants[idx] = g
    }
    return g
  }

  /**
   * The geometry a fragment is drawn with: a splinter is a pointed, frayed sliver; MDF breaks in lumps, plywood peels in ragged veneer, the stub of a broken
   * board ends in torn strands at +x; the rest are boxes.
   */
  private geometryOf(f: Fragment): THREE_NS.BufferGeometry {
    const seed = hashString(f.id)
    if (f.shape === 'shard') return this.shardGeometry(seed)
    if (f.shape === 'splinter') return this.sharedGeometry('sliver', seed)
    const form = this.o.formOf?.(f.material)
    if (f.shape === 'chunk' && form === 'granules') return this.sharedGeometry('lump', seed)
    if (f.shape === 'scrap' && form === 'plies') return this.sharedGeometry('veneer', seed)
    if (f.shape === 'slab' && (form === 'slivers' || form === 'plies')) return this.sharedGeometry('board', seed)
    if (f.shape === 'chunk' && this.o.crumbles?.(f.material)) return this.sharedGeometry('rubble', seed)
    return this.box
  }

  private markGeometry: THREE_NS.CircleGeometry | null = null
  private markMaterial: THREE_NS.MeshBasicMaterial | null = null

  private markParts(): { geometry: THREE_NS.CircleGeometry; material: THREE_NS.MeshBasicMaterial } {
    this.markGeometry ??= new this.THREE.CircleGeometry(1, 10)
    this.markMaterial ??= new this.THREE.MeshBasicMaterial({ color: 0x0b0a09, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    return { geometry: this.markGeometry, material: this.markMaterial }
  }

  /**
   * Meshes, never put in a scene by this class, that draw every shared piece of a fragment once: the box, the six shards, the wood splinters, MDF lumps, plywood veneer, broken masonry, the bullet-hole disc, and the opaque and
   * glass materials. A host draws them at load so the first blast does not upload these buffers in the middle of a frame.
   */
  warmMeshes(): THREE_NS.Mesh[] {
    const opaque = this.materialFor('warm', 0x808080, false)
    const glass = this.materialFor('warm', 0x808080, true)
    const geometries = [this.box, ...Array.from({ length: SHARD_SHAPES }, (_, index) => this.shardGeometry(index))]
    const shaped = (['sliver', 'lump', 'veneer', 'board', 'rubble'] as const).flatMap((shape) => Array.from({ length: FRAGMENT_SHAPE_VARIANTS }, (_, index) => this.sharedGeometry(shape, index)))
    const { geometry, material } = this.markParts()
    return [
      ...geometries.flatMap((shared) => [new this.THREE.Mesh(shared, opaque), new this.THREE.Mesh(shared, glass)]),
      ...shaped.map((shared) => new this.THREE.Mesh(shared, opaque)),
      new this.THREE.Mesh(geometry, material),
    ]
  }

  /**
   * Bullet holes that stay on a fragment (`Fragment.marks`): dark discs that are children of its mesh, so they fall, spin and settle with it. The mesh is
   * a unit box scaled to the fragment, so each disc is scaled back; exact for a mark on a face, which is where a bullet hole is.
   */
  addMarks(mesh: THREE_NS.Mesh, f: Fragment): void {
    if (!f.marks?.length) return
    const { geometry, material } = this.markParts()
    const sc = mesh.scale
    for (const mark of f.marks) {
      const disc = new this.THREE.Mesh(geometry, material)
      const radius = Math.max(0.004, mark.diameter) * 0.6
      const n = this.v.set(mark.normal[0], mark.normal[1], mark.normal[2]).normalize()
      disc.position.set(mark.point[0] / sc.x + (n.x * 0.002) / sc.x, mark.point[1] / sc.y + (n.y * 0.002) / sc.y, mark.point[2] / sc.z + (n.z * 0.002) / sc.z)
      disc.quaternion.setFromUnitVectors(this.w.set(0, 0, 1), n)
      disc.scale.set(radius / sc.x, radius / sc.y, radius / sc.z)
      mesh.add(disc)
    }
  }

  /**
   * Create the mesh of a fragment and start its motion. `maxAllowed` is the live budget: over it the oldest fragment still showing fades out to make room, and a burst
   * bigger than the budget (every live fragment was made in this same frame) does not make the rest at all, so a blast never builds a thousand meshes only to fade them
   * out. Returns null when the fragment was not made.
   */
  /**
   * Throws `f` into the scene, within `maxAllowed` live fragments (the oldest small ones make room first). A `lasting` fragment (a steel bar) is debris that
   * stays: it has a body the player and the pieces run into, however thin it is, and it never fades.
   */
  spawn(f: Fragment, material: THREE_NS.Material, home: string, maxAllowed: number, lasting = false): THREE_NS.Mesh | null {
    if (this.list.length >= maxAllowed) {
      let alive = 0
      let oldest: Live | undefined
      let oldestSmall: Live | undefined
      for (const l of this.list) {
        if (l.dying) continue
        alive++
        oldest ??= l
        if (!l.body) oldestSmall ??= l
      }
      // the splinters go first; the big ones only when nothing else is left
      oldest = oldestSmall ?? oldest
      if (alive >= maxAllowed) {
        if (!oldest || oldest.born === this.tick) return null
        oldest.dying = true
      }
    }
    const geo = this.geometryOf(f)
    const mesh = new this.THREE.Mesh(geo, material)
    mesh.position.set(f.center[0], f.center[1], f.center[2])
    mesh.quaternion.set(f.rotation[0], f.rotation[1], f.rotation[2], f.rotation[3]).normalize()
    const sz = f.size
    const sc = new this.THREE.Vector3(Math.max(0.005, sz[0]), Math.max(0.005, sz[1]), Math.max(0.003, sz[2]))
    mesh.scale.copy(sc)
    mesh.castShadow = true
    // pure visual debris: a host that picks with a raycast can skip it
    mesh.userData.destructionDebris = true
    mesh.name = 'fragment'
    markKitOrigin(mesh, { owner: 'game-destruction-three', kind: 'fragment', id: f.material })
    this.o.scene.add(mesh)
    const live: Live = {
      mesh,
      floor: null,
      home,
      vel: new this.THREE.Vector3(f.velocity[0], f.velocity[1], f.velocity[2]),
      ang: new this.THREE.Vector3(f.angularVelocity[0], f.angularVelocity[1], f.angularVelocity[2]),
      // shards are thin: the contact extent uses the real (small) thickness, the chunk uses half of each side
      half: sc.clone().multiplyScalar(0.5),
      baseScale: sc,
      still: 0,
      asleep: false,
      contact: false,
      rest: 0,
      fade: 1,
      dying: false,
      air: f.shape === 'scrap' && sz[2] <= SHEET_MAX ? SHEET_AIR : 0,
      body: null,
      born: this.tick,
      life: lasting ? 0 : Math.max(0, typeof this.o.life === 'function' ? this.o.life(f, home) : this.o.life),
    }
    // a big piece stays where it fell, whatever its shape: a slab of a roof tile is debris as much as a chunk of brick is
    if (lasting || isBig(f.size)) {
      live.body = {
        mass: f.mass,
        push: (x, z) => {
          live.vel.x = x
          live.vel.z = z
          live.vel.y = Math.max(live.vel.y, 0.3)
          this.rouse(live)
        },
      }
    }
    this.list.push(live)
    this.addMarks(mesh, f)
    return mesh
  }

  /** The boxes of the big fragments around (x, z). */
  solidsNear(x: number, z: number, radius: number, found: (home: string, min: [number, number, number], max: [number, number, number], body: LooseBody) => void): void {
    const boxes: number[] = []
    for (const f of this.list) {
      if (!f.body || f.dying) continue
      const reach = f.half.length() + radius
      if (Math.abs(f.mesh.position.x - x) > reach || Math.abs(f.mesh.position.z - z) > reach) continue
      f.mesh.updateMatrixWorld()
      boxes.length = 0
      pushFittedBoxes(this.unitBox, f.mesh.matrixWorld, boxes)
      for (let i = 0; i < boxes.length; i += 6) {
        if (x < boxes[i] - radius || x > boxes[i + 3] + radius || z < boxes[i + 2] - radius || z > boxes[i + 5] + radius) continue
        found(f.home, [boxes[i], boxes[i + 1], boxes[i + 2]], [boxes[i + 3], boxes[i + 4], boxes[i + 5]], f.body)
      }
    }
  }

  /** Add velocity to every fragment within `radius` of a point (blasts). */
  blast(point: [number, number, number], radius: number, speed: number): void {
    for (const f of this.list) {
      const d = this.v.copy(f.mesh.position).sub(this.w.set(point[0], point[1], point[2]))
      const dist = d.length()
      if (dist > radius || f.dying) continue
      const k = (1 - dist / radius) ** 2 * speed
      d.normalize().multiplyScalar(k)
      d.y += k * 0.4
      f.vel.add(d)
      f.ang.add(this.w.set(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).multiplyScalar(k))
      this.rouse(f)
    }
  }

  /** A fragment that came to rest stops having its matrix recomputed on every frame; whatever moves it again calls this first. */
  private rouse(f: Live): void {
    f.asleep = false
    f.box = undefined
    f.rest = 0
    // what it lay on may be gone: the floor is measured again where it lies
    f.floor = null
    f.mesh.matrixAutoUpdate = true
  }

  /** What lies inside the disc looks at the ground again: it was dug or heaped under it. */
  wakeRegion(x: number, z: number, radius: number): void {
    for (const f of this.list) {
      if (!f.asleep || Math.hypot(f.mesh.position.x - x, f.mesh.position.z - z) > radius) continue
      this.rouse(f)
    }
  }

  update(dt: number): void {
    this.tick++
    this.wakeUnsupported()
    const g = this.o.gravity
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]
      if (f.dying) {
        f.mesh.matrixAutoUpdate = true
        f.fade -= dt / 0.6
        if (f.fade <= 0) {
          this.o.scene.remove(f.mesh)
          this.list.splice(i, 1)
          continue
        }
        f.mesh.scale.copy(f.baseScale).multiplyScalar(f.fade)
      }
      if (f.asleep) {
        f.rest += dt
        if (f.life > 0 && f.rest > f.life && !f.body) {
          f.dying = true
          f.mesh.matrixAutoUpdate = true
        }
        continue
      }
      this.step(f, dt, g)
    }
    this.keepBudget()
  }

  /** Over `maxAwake` fragments moving, the oldest at rest on what is under them sleep where they lie (`FragmentSystemOptions.maxAwake`). */
  private keepBudget(): void {
    const most = this.o.maxAwake
    if (most === undefined || !Number.isFinite(most)) return
    let awake = 0
    for (const f of this.list) if (!f.asleep && !f.dying) awake++
    for (const f of this.list) {
      if (awake <= most) return
      if (f.asleep || f.dying || !f.contact || !isSlow(f)) continue
      this.sleep(f)
      awake--
    }
  }

  /** The fragment stops where it lies, and its matrix is no longer recomputed every frame. */
  private sleep(f: Live): void {
    f.asleep = true
    f.box = undefined
    f.mesh.updateMatrix()
    f.mesh.matrixAutoUpdate = false
    f.vel.set(0, 0, 0)
    f.ang.set(0, 0, 0)
  }

  /** A few fragments asleep each update (`SUPPORT_CHECKS`, in turn) look at the ground under them again: one left over air falls. */
  private wakeUnsupported(): void {
    const n = this.list.length
    for (let k = 0; k < Math.min(SUPPORT_CHECKS, n); k++) {
      this.supportTurn = (this.supportTurn + 1) % n
      const f = this.list[this.supportTurn]
      if (!f.asleep || f.dying) continue
      const e = this.m.makeRotationFromQuaternion(f.mesh.quaternion).elements
      const ext = Math.abs(e[1]) * f.half.x + Math.abs(e[5]) * f.half.y + Math.abs(e[9]) * f.half.z
      // measured afresh: the floor kept from its landing is the top it landed on, which may have broken or been carried off since
      f.floor = null
      const bottom = f.mesh.position.y - ext
      if (bottom > Math.max(this.floorUnder(f), this.pileUnder(f, bottom)) + SUPPORT_GAP) this.rouse(f)
    }
  }

  /** What a fragment lands on: measured where it is, and again only once it moved `FLOOR_REMEASURE` m off that spot (a ray down is not free). */
  private floorUnder(f: Live): number {
    const p = f.mesh.position
    if (!this.o.surfaceAt) return this.o.groundAt(p.x, p.z)
    const at = f.floor
    if (!at || Math.abs(at.x - p.x) > FLOOR_REMEASURE || Math.abs(at.z - p.z) > FLOOR_REMEASURE || p.y < at.y - FLOOR_REMEASURE) {
      f.floor = { x: p.x, z: p.z, y: this.o.surfaceAt(p.x, p.y, p.z) }
    }
    return f.floor!.y
  }

  private step(f: Live, dt: number, g: number): void {
    const mesh = f.mesh
    f.vel.y -= g * dt
    mesh.position.addScaledVector(f.vel, dt)
    const w = f.ang.length()
    if (w > 1e-5) {
      this.dq.setFromAxisAngle(this.v.copy(f.ang).multiplyScalar(1 / w), w * dt)
      mesh.quaternion.premultiply(this.dq).normalize()
    }
    // ground contact: lowest point of the oriented box
    this.m.makeRotationFromQuaternion(mesh.quaternion)
    const e = this.m.elements
    const h = f.half
    const sc = f.dying ? f.fade : 1
    const ext = (Math.abs(e[1]) * h.x + Math.abs(e[5]) * h.y + Math.abs(e[9]) * h.z) * sc
    const gy = Math.max(this.floorUnder(f), this.pileUnder(f, mesh.position.y - ext + Math.max(0, -f.vel.y) * dt))
    let contact = false
    if (mesh.position.y - ext < gy) {
      contact = true
      mesh.position.y = gy + ext
      if (f.vel.y < -0.6) {
        f.vel.y = -f.vel.y * 0.25
        f.vel.x *= 0.7
        f.vel.z *= 0.7
        f.ang.multiplyScalar(0.55)
        // a hit on a corner makes it tumble a little
        f.ang.x += (this.rng() - 0.5) * 2
        f.ang.z += (this.rng() - 0.5) * 2
      } else {
        f.vel.y = 0
        const fr = Math.exp(-7 * dt)
        f.vel.x *= fr
        f.vel.z *= fr
        f.ang.multiplyScalar(Math.exp(-6 * dt))
      }
    } else {
      f.ang.multiplyScalar(Math.exp(-0.15 * dt))
      if (f.air > 0) this.flutter(f, dt)
    }
    if (contact && f.vel.lengthSq() < 4) this.settle(f, dt)
    f.contact = contact
    if (contact && isSlow(f)) {
      f.still += dt
      if (f.still > SETTLE_SECONDS) this.sleep(f)
    } else {
      f.still = 0
    }
  }

  /**
   * The top of the debris lying under a falling fragment: a piece lands on the pile, not through it, so two flat pieces never end up inside each other. Only pieces
   * below it count (a resting one keeps its box), those whose top is at or below where the faller's bottom was a step ago plus a small step.
   */
  private pileUnder(f: Live, bottom: number): number {
    const p = f.mesh.position
    const e = this.m.makeRotationFromQuaternion(f.mesh.quaternion).elements
    const reachX = Math.abs(e[0]) * f.half.x + Math.abs(e[4]) * f.half.y + Math.abs(e[8]) * f.half.z
    const reachZ = Math.abs(e[2]) * f.half.x + Math.abs(e[6]) * f.half.y + Math.abs(e[10]) * f.half.z
    let top = Number.NEGATIVE_INFINITY
    for (const other of this.list) {
      if (other === f || other.dying) continue
      const box = other.asleep ? (other.box ??= restingBox(other)) : restingBox(other)
      if (box.top > bottom + PILE_STEP || box.top <= top) continue
      if (Math.abs(box.x - p.x) >= box.reachX + reachX || Math.abs(box.z - p.z) >= box.reachZ + reachZ) continue
      top = box.top
    }
    return top
  }

  /** A sheet in the air: drag slows it to a slow fall, and it sways and turns over as it goes. */
  private flutter(f: Live, dt: number): void {
    f.vel.multiplyScalar(Math.exp(-f.air * dt))
    f.vel.x += (this.rng() - 0.5) * SHEET_SWAY * dt
    f.vel.z += (this.rng() - 0.5) * SHEET_SWAY * dt
    f.ang.x += (this.rng() - 0.5) * SHEET_SWAY * 4 * dt
    f.ang.z += (this.rng() - 0.5) * SHEET_SWAY * 4 * dt
  }

  /** Tip the fragment towards lying on its flattest face. */
  private settle(f: Live, dt: number): void {
    const mesh = f.mesh
    this.m.makeRotationFromQuaternion(mesh.quaternion)
    const e = this.m.elements
    const up = [e[1], e[5], e[9]] // world-y component of each local axis
    const half = [f.half.x, f.half.y, f.half.z]
    let small = 0
    for (let i = 1; i < 3; i++) if (half[i] < half[small]) small = i
    let axis = small
    // a broken board does not stand on its end
    if (Math.abs(up[small]) < 0.35 && !f.body) {
      axis = 0
      for (let i = 1; i < 3; i++) if (Math.abs(up[i]) > Math.abs(up[axis])) axis = i
    }
    const sign = up[axis] >= 0 ? 1 : -1
    this.v.set(e[axis * 4], e[axis * 4 + 1], e[axis * 4 + 2]).multiplyScalar(sign)
    this.w.set(0, 1, 0)
    this.dq.setFromUnitVectors(this.v, this.w)
    this.q.copy(this.dq).multiply(mesh.quaternion)
    mesh.quaternion.slerp(this.q, clamp(dt * 7, 0, 1))
  }

  /** Remove the fragments of one object (after `restore`). */
  removeHome(home: string): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].home === home) {
        this.o.scene.remove(this.list[i].mesh)
        this.list.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const f of this.list) this.o.scene.remove(f.mesh)
    this.list.length = 0
  }

  /** `clear`, the random stream back to its seed and the tick to 0: what comes next flies as on a new system. */
  reset(): void {
    this.clear()
    this.rng = createRng(FRAGMENT_SEED)
    this.tick = 0
  }

  dispose(): void {
    this.clear()
    this.box.dispose()
    this.markGeometry?.dispose()
    this.markMaterial?.dispose()
    for (const g of this.shardGeos) g?.dispose()
    this.shardGeos = []
    for (const variants of this.shapeGeos.values()) for (const g of variants) g?.dispose()
    this.shapeGeos.clear()
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }
}
