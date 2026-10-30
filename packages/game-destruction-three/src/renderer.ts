import type * as THREE_NS from 'three'
import type { DebrisKind, DestructionEvent, Fragment, MaterialDef, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { blastShove } from '@adatechnology/game-contracts'
import { createVfx, effectForEvent, EVENT_EFFECTS_MAP } from '@adatechnology/game-vfx'
import type { GameEvent } from '@adatechnology/game-vfx'
import type { VfxWorld } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import { FragmentSystem } from './fragments'
import { GroundSpots } from './ground'
import type { Bound, HostVis, MeshVis, PartVis, PieceBody } from './internal'
import { clamp, createRng, hashNumbers, hashString, mixHex } from './math'
import { PieceSystem } from './pieces'
import { RebarCages } from './rebar'
import { partHintOf, specFrameInverse } from './spec'
import type { WarmUpProbes } from '@adatechnology/game-contracts'
import type { DestructionRenderer, BindOptions, ExplodeOptions, Mesh, MeshRange, Object3D, Piece, RendererOptions, ThreeNamespace } from './types'
import { Visuals } from './visual'

let rendererCount = 0
const IMPACT_TAGS = ['metal', 'glass', 'wood'] as const

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>

const GLOW_FROM_C = 430
const QUEUE_CAP = 4000
/** A part's fire lasts until the part stops burning (`stopFire`); this is only the ceiling the effects world needs. */
const FIRE_CEILING_SECONDS = 3600
/** The `generic` explosion is the M67's (15 m injury radius): a blast with no effect id of its own scales with its radius. */
const GENERIC_REFERENCE_RADIUS = 15
/** The small flame of a part that a bullet or fire primed: it burns until the part goes off. */
const PRIMED_FIRE_RADIUS = 0.2

interface FireEmitter {
  object: string
  part: string
  point: Vec3
  /** The burning part's position, moved every frame; the effects world's fire follows it. */
  follow: { x: number; y: number; z: number }
  /** Handle of the fire in the effects world, once the part's box is known. */
  handle?: number
}

interface Leak {
  object: string
  part: string
  fluid: string
  point: Vec3
  direction: Vec3
  rate: number
  pressurized: boolean
  acc: number
  /** The part had a through opening when the leak began: the leak ends when it has none (a valve shut with `seal`). */
  opened: boolean
  localPoint?: Vec3
  localDirection?: Vec3
  lastLiters?: number
  idleSeconds?: number
  life?: number
}

const FLUID_COLORS: Record<string, number> = {
  water: 0x8cc8ff,
  fuel: 0xd9a032,
  oil: 0x2a2018,
  gas: 0xf2f2f2,
  sap: 0xb89b3a,
  acid: 0x9bd23c,
  blood: 0x8a0a0a,
  soda: 0x3a1e12,
  coffee: 0x3b2414,
  beer: 0xd9953c,
  milk: 0xf4f1ea,
  wine: 0x6b101f,
  juice: 0xe8870b,
}
const SMOKE_TONES: Record<string, number> = { white: 0xe6e6e6, grey: 0x8a8a8a, black: 0x2a2a2a }

const DEFAULT_SPEED: Record<string, number> = {
  sparks: 3,
  splinters: 2.5,
  dust: 1,
  shards: 2.5,
  fibers: 1.2,
  leaves: 1.2,
  drips: 0.5,
  ash: 0.8,
  chips: 2.5,
  smoke: 0.8,
  steam: 1,
  fire: 1.2,
  flash: 0,
  foam: 2.5,
}

/** Sound key for an impact on a material. */
function impactKey(def: MaterialDef | undefined): string {
  if (!def) return 'impact_wood'
  const tags = def.tags ?? []
  if (tags.includes('metal')) return 'impact_metal'
  if (def.visual?.transparent || def.fracture === 'shatter') return 'impact_glass'
  if (def.fracture === 'crumble') return 'impact_masonry'
  if (def.fracture === 'tear') return 'impact_soft'
  return def.fracture === 'none' ? 'impact_metal' : 'impact_wood'
}

function fractureKey(def: MaterialDef | undefined, style: string): string {
  switch (style) {
    case 'shatter':
      return 'shatter_glass'
    case 'crumble':
      return 'crumble'
    case 'splinter':
      return 'splinter'
    default:
      return impactKey(def)
  }
}

function fallbackColor(id: string, def: MaterialDef | undefined): number {
  if (def?.tags?.includes('metal')) return 0x8a8f96
  if (def?.visual?.transparent) return 0x9fd0e0
  const h = hashString(id)
  return mixHex(0x6b5a48, 0x9a9488, (h % 100) / 100)
}

function materialsOf(m: THREE_NS.Material | THREE_NS.Material[]): THREE_NS.Material[] {
  return Array.isArray(m) ? m : [m]
}

function isMeshRange(v: Object3D | MeshRange): v is MeshRange {
  const r = v as Partial<MeshRange>
  return !!r.mesh && Array.isArray(r.range)
}

/** Create the renderer. See `DestructionRenderer`. */
export function createDestructionRenderer(THREE: ThreeNamespace, options: RendererOptions): DestructionRenderer {
  return new Renderer(THREE, options)
}

class Renderer implements DestructionRenderer {
  private readonly world: RendererOptions['world']
  private readonly scene: THREE_NS.Scene
  private readonly quality: 'low' | 'medium' | 'high'
  private readonly low: boolean
  private readonly groundAt: (x: number, z: number) => number
  private readonly gravity: number
  private readonly autoSplit: boolean
  private readonly maxFragments: number
  private readonly bounds = new Map<string, Bound>()
  private readonly queue: DestructionEvent[] = []
  private readonly unsubscribe: () => void
  private readonly visuals: Visuals
  private readonly fragments: FragmentSystem
  private readonly ground: GroundSpots
  private readonly pieceSys: PieceSystem
  private readonly cages: RebarCages
  private readonly active = new Map<string, { object: string; part: string }>()
  private readonly fires = new Map<string, FireEmitter>()
  /** Primed parts burning in the effects world until they go off: their burn loop ends when they are put out. */
  private readonly primedBurning = new Set<string>()
  private readonly leaks: Leak[] = []
  private readonly homeTags: string[] = []
  private readonly throttles = new Map<string, number>()
  private readonly rng = createRng(0xc0ffee)
  private readonly vfx: VfxWorld
  /** Names this renderer to the world's drips, so a shared world tells each renderer where its own landed. */
  private readonly owner = `destruction-${++rendererCount}`
  private readonly stopLanding: () => void
  /** The effects renderer made here when the host gave no shared world; it is stepped in `update`. */
  private readonly ownVfx: VfxRenderer | undefined
  private time = 0
  private scanTimer = 0
  private disposed = false
  private readonly box: THREE_NS.Box3
  private readonly tmpQ: THREE_NS.Quaternion
  private readonly v1: THREE_NS.Vector3
  private readonly v2: THREE_NS.Vector3

  constructor(
    private readonly THREE: ThreeNamespace,
    private readonly o: RendererOptions,
  ) {
    this.world = o.world
    this.scene = o.scene
    this.quality = o.quality ?? 'medium'
    this.low = this.quality === 'low'
    this.groundAt = o.groundAt ?? (() => 0)
    this.gravity = o.gravity ?? 9.81
    this.autoSplit = o.autoSplit !== false
    this.maxFragments = o.maxFragments ?? 160
    this.box = new THREE.Box3()
    this.tmpQ = new THREE.Quaternion()
    this.v1 = new THREE.Vector3()
    this.v2 = new THREE.Vector3()
    const maxParticles = Math.max(8, Math.floor((o.maxParticles ?? 2500) * (this.low ? 0.5 : 1)))
    this.visuals = new Visuals(THREE, this.low, 600)
    this.ground = new GroundSpots(THREE, o.scene, this.groundAt, 48)
    this.vfx = o.vfx ?? createVfx({ profile: this.quality, gravity: this.gravity, groundAt: this.groundAt, sprites: { capacity: maxParticles, density: this.low ? 0.6 : 1 } })
    this.ownVfx = o.vfx ? undefined : createVfxRenderer(THREE, { scene: o.scene, camera: o.camera ?? new THREE.PerspectiveCamera(), vfx: this.vfx, pointScale: o.pointScale ?? 700 })
    this.stopLanding = this.vfx.onLand(this.owner, (x, _y, z, color, tag) => {
      const home = this.homeTags[tag - 1] ?? ''
      this.ground.add('puddle', x, z, 0.05 + this.rng() * 0.04, color, home)
    })
    this.fragments = new FragmentSystem(THREE, {
      scene: o.scene,
      groundAt: this.groundAt,
      gravity: this.gravity,
      max: this.maxFragments,
      life: o.fragmentLife ?? 12,
    })
    this.cages = new RebarCages(THREE, o.scene)
    this.pieceSys = new PieceSystem(THREE, {
      groundAt: this.groundAt,
      gravity: this.gravity,
      scene: o.scene,
      onHardLanding: (p, point, speed) => this.hardLanding(p, point, speed),
    })
    this.unsubscribe = this.world.on('*', (ev) => {
      if (this.queue.length < QUEUE_CAP) this.queue.push(ev)
    })
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Binding
  // ----------------------------------------------------------------------------------------------------------------------------------

  bind(objectId: string, root: Object3D, options: BindOptions = {}): void {
    if (this.bounds.has(objectId)) this.unbind(objectId)
    const state = this.world.state(objectId)
    const partIds = new Set((state?.parts ?? []).map((p) => p.id))
    const byPart = new Map<string, Array<{ mesh: Mesh; range?: [number, number] }>>()
    const taken = new Set<Mesh>()
    const put = (pid: string, e: { mesh: Mesh; range?: [number, number] }): void => {
      const l = byPart.get(pid)
      if (l) l.push(e)
      else byPart.set(pid, [e])
    }
    const add = (pid: string, m: Mesh): void => {
      if (taken.has(m)) return
      taken.add(m)
      put(pid, { mesh: m })
    }
    const addRange = (pid: string, r: MeshRange): void => {
      const n = (r.mesh.geometry.getAttribute('position')?.count ?? 0) as number
      const [v0, v1] = r.range
      if (!Number.isInteger(v0) || !Number.isInteger(v1) || v0 < 0 || v1 <= v0 || v1 > n) {
        throw new Error(`game-destruction-three: invalid vertex range [${v0}, ${v1}) for part "${pid}" (the mesh has ${n} vertices)`)
      }
      put(pid, { mesh: r.mesh, range: [v0, v1] })
    }
    const meshesIn = (o: Object3D): Mesh[] => {
      const out: Mesh[] = []
      o.traverse((c) => {
        if ((c as Mesh).isMesh) out.push(c as Mesh)
      })
      return out
    }
    if (options.parts) {
      for (const [pid, v] of Object.entries(options.parts)) {
        for (const o of Array.isArray(v) ? v : [v]) {
          if (isMeshRange(o)) addRange(pid, o)
          else for (const m of meshesIn(o)) add(pid, m)
        }
      }
    } else {
      const leftovers: Mesh[] = []
      for (const m of meshesIn(root)) {
        const ud = partHintOf(m.userData?.destructionPart)?.id
        if (ud !== undefined && partIds.has(ud)) add(ud, m)
        else if (partIds.has(m.name)) add(m.name, m)
        else leftovers.push(m)
      }
      if (leftovers.length) this.matchByBox(objectId, root, leftovers, add)
    }
    const bound: Bound = { id: objectId, root, sync: options.syncTransform !== false, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: false }
    const hosts = new Map<Mesh, HostVis>()
    for (const pid of partIds) bound.parts.set(pid, this.makePartVis(objectId, pid, state?.parts.find((p) => p.id === pid)?.material ?? '', byPart.get(pid) ?? [], hosts))
    for (const [pid, meshes] of byPart) {
      if (!bound.parts.has(pid)) bound.parts.set(pid, this.makePartVis(objectId, pid, this.world.part(objectId, pid)?.material ?? '', meshes, hosts))
    }
    this.bounds.set(objectId, bound)
    for (const pv of bound.parts.values()) this.tagPart(pv, objectId)
  }

  /**
   * Label the meshes of a part so a host can go from a raycast hit to the world: `userData.destructionPart` (the part id) and
   * `userData.destructionObject` (the id of the world object that part belongs to now; a loose piece has an id of its own). Parts drawn by a range
   * of a merged mesh share that mesh with others and are left alone until they get a mesh of their own. Decals are marked `destructionDebris`.
   */
  private tagPart(pv: PartVis, objectId: string): void {
    for (const mv of pv.meshes) {
      if (mv.merged && !mv.loose) continue
      mv.mesh.traverse((c) => {
        if (!(c as Mesh).isMesh) return
        const ud = c.userData as Record<string, unknown>
        if (ud.destructionDebris) return
        if (partHintOf(ud.destructionPart)?.id !== pv.id) ud.destructionPart = pv.id
        ud.destructionObject = objectId
      })
    }
  }

  private makePartVis(home: string, id: string, material: string, meshes: Array<{ mesh: Mesh; range?: [number, number] }>, hosts: Map<Mesh, HostVis>): PartVis {
    return { id, home, material, meshes: meshes.map((m) => this.visuals.makeMeshVis(m.mesh, home, m.range, hosts)), charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' }
  }

  /** Match unlabelled meshes to the part whose shape contains the centre of the mesh's bounding box. */
  private matchByBox(objectId: string, root: Object3D, meshes: Mesh[], add: (pid: string, m: Mesh) => void): void {
    let specParts: PartSpec[] | undefined
    try {
      specParts = this.world.serialize?.().objects.find((o) => o.id === objectId)?.spec.parts
    } catch {
      specParts = undefined
    }
    if (!specParts) return
    const frame = specFrameInverse(this.THREE, root)
    const e = new this.THREE.Euler()
    const q = new this.THREE.Quaternion()
    for (const m of meshes) {
      this.box.setFromObject(m)
      if (this.box.isEmpty()) continue
      const c = this.box.getCenter(this.v1).applyMatrix4(frame)
      let best: PartSpec | null = null
      let bestVol = Infinity
      for (const p of specParts) {
        const l = this.v2.set(c.x - p.position[0], c.y - p.position[1], c.z - p.position[2])
        if (p.rotation) l.applyQuaternion(q.setFromEuler(e.set(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')).invert())
        let inside = false
        let vol = 0
        const s = p.shape
        if (s.kind === 'box') {
          inside = Math.abs(l.x) <= s.size[0] / 2 && Math.abs(l.y) <= s.size[1] / 2 && Math.abs(l.z) <= s.size[2] / 2
          vol = s.size[0] * s.size[1] * s.size[2]
        } else if (s.kind === 'cylinder') {
          inside = Math.hypot(l.x, l.z) <= s.radius && Math.abs(l.y) <= s.height / 2
          vol = Math.PI * s.radius * s.radius * s.height
        } else {
          inside = l.length() <= s.radius
          vol = (4 / 3) * Math.PI * s.radius ** 3
        }
        if (inside && vol < bestVol) {
          best = p
          bestVol = vol
        }
      }
      if (best) add(best.id, m)
    }
  }

  unbind(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b) return
    this.restore(objectId)
    this.pieceSys.remove(objectId)
    this.bounds.delete(objectId)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Pieces
  // ----------------------------------------------------------------------------------------------------------------------------------

  /** Half extents and centre of the box around some meshes, in the metric frame of `root` (its pose removed, its scale kept). */
  private measure(root: Object3D, meshes: MeshVis[]): { half: Vec3; center: THREE_NS.Vector3 } {
    const inv = specFrameInverse(this.THREE, root)
    const total = new this.THREE.Box3()
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    for (const mv of meshes) {
      const m = mv.mesh
      m.updateWorldMatrix(true, false)
      this.visuals.localBox(mv, lb)
      if (lb.isEmpty()) continue
      total.union(lb.clone().applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld)))
    }
    if (total.isEmpty()) return { half: [0.25, 0.25, 0.25], center: new this.THREE.Vector3() }
    const size = total.getSize(new this.THREE.Vector3())
    return { half: [Math.max(0.02, size.x / 2), Math.max(0.02, size.y / 2), Math.max(0.02, size.z / 2)], center: total.getCenter(new this.THREE.Vector3()) }
  }

  private meshesOf(b: Bound): MeshVis[] {
    const out: MeshVis[] = []
    for (const pv of b.parts.values()) if (pv.gone === 'none') for (const mv of pv.meshes) out.push(mv)
    return out
  }

  private massOf(objectId: string): number {
    const st = this.world.state(objectId)
    if (!st) return 5
    let m = 0
    for (const p of st.parts) if (p.status !== 'broken' && p.status !== 'melted' && p.status !== 'ashes') m += p.mass
    return m > 0 ? m : 5
  }

  makePiece(objectId: string, options: { mass?: number; velocity?: Vec3 } = {}): Piece {
    const b = this.bounds.get(objectId)
    if (!b) throw new Error(`game-destruction-three: object "${objectId}" is not bound`)
    if (b.root.parent && b.root.parent !== this.scene) this.scene.attach(b.root)
    const { half, center } = this.measure(b.root, this.meshesOf(b))
    const piece = this.pieceSys.create(objectId, b.root, half, center, options.mass ?? this.massOf(objectId), options.velocity)
    b.piece = piece
    return piece
  }

  pieces(): Piece[] {
    return [...this.pieceSys.list]
  }

  piece(objectId: string): Piece | null {
    return this.pieceSys.get(objectId)
  }

  impulse(objectId: string, impulse: Vec3, point?: Vec3): void {
    const p = this.pieceSys.get(objectId)
    if (p) this.pieceSys.impulse(p, impulse, point)
  }

  private hardLanding(p: PieceBody, point: Vec3, speed: number): void {
    const key = this.impactSoundOf(p.objectId)
    this.sound(key, point, clamp(speed / 10, 0.2, 1))
    // the piece just moved this frame: the world must know where it is before the hit is resolved against its parts
    this.syncBound(p.objectId)
    try {
      this.world.hit(p.objectId, { type: 'blunt', point, energy: 0.5 * p.mass * speed * speed, radius: 0.08, direction: [0, -1, 0], source: 'fall' })
    } catch {
      // the object may have been removed from the world
    }
  }

  private impactSoundOf(objectId: string): string {
    const st = this.world.state(objectId)
    let best: MaterialDef | undefined
    let mass = -1
    for (const p of st?.parts ?? []) {
      if (p.mass > mass) {
        mass = p.mass
        best = this.world.materials.get(p.material)
      }
    }
    return impactKey(best)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Update
  // ----------------------------------------------------------------------------------------------------------------------------------

  update(dt: number): void {
    if (this.disposed) return
    dt = clamp(dt, 0, 0.1)
    this.time += dt
    this.drainQueue()
    // a settling object keeps moving between its (throttled) `settle` events
    for (const b of this.bounds.values()) if (b.soilNode && this.world.state(b.id)?.soil?.status === 'yielding') this.onSettle(b.id)
    this.updateActive(dt)
    this.updateLeaks(dt)
    this.pieceSys.update(dt)
    this.fragments.update(dt)
    this.ground.update(dt)
    this.ownVfx?.update(dt)
    this.syncTransforms()
  }

  private drainQueue(): void {
    // events produced while applying (a hard landing calls `hit`) wait for the next frame
    const batch = this.queue.splice(0, this.queue.length)
    for (const ev of batch) {
      try {
        this.apply(ev)
      } catch (err) {
        if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', ev.type, err)
      }
    }
  }

  /**
   * The ground under an object settled or tilted: its parts are drawn under a node with the soil's offset (`ObjectState.soil.offset`), so the host's
   * root keeps the pose the host gave and the world keeps getting it from `syncTransform`.
   */
  private onSettle(objectId: string): void {
    const b = this.bounds.get(objectId)
    const soil = this.world.state(objectId)?.soil
    if (!b || !soil) return
    let node = b.soilNode
    if (!node) {
      node = new this.THREE.Group()
      node.name = 'destruction-soil'
      for (const c of [...b.root.children]) node.add(c)
      b.root.add(node)
      b.soilNode = node
    }
    const { position: p, rotation: q } = soil.offset
    node.position.set(p[0], p[1], p[2])
    node.quaternion.set(q[0], q[1], q[2], q[3])
    node.updateMatrixWorld(true)
  }

  private syncTransforms(): void {
    for (const b of this.bounds.values()) this.syncOne(b)
  }

  /** Push the current transform of one bound object to the world right now (used before a landing hit). */
  private syncBound(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (b) this.syncOne(b)
  }

  private syncOne(b: Bound): void {
    if (!b.sync) return
    const p = this.v1
    const q = this.tmpQ
    b.root.updateWorldMatrix(true, false)
    b.root.matrixWorld.decompose(p, q, this.v2)
    const last = b.lastPos
    const lq = b.lastQuat
    const moved = !last || !lq || Math.abs(p.x - last[0]) + Math.abs(p.y - last[1]) + Math.abs(p.z - last[2]) > 1e-5 || Math.abs(q.x - lq[0]) + Math.abs(q.y - lq[1]) + Math.abs(q.z - lq[2]) + Math.abs(q.w - lq[3]) > 1e-6
    if (!moved) return
    b.lastPos = [p.x, p.y, p.z]
    b.lastQuat = [q.x, q.y, q.z, q.w]
    if (this.world.has(b.id)) this.world.setTransform(b.id, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w])
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Events
  // ----------------------------------------------------------------------------------------------------------------------------------

  private apply(ev: DestructionEvent): void {
    switch (ev.type) {
      case 'damage':
        if (ev.damageType === 'heat' || ev.damageType === 'fire' || ev.damageType === 'explosive') this.activate(ev.object, ev.part)
        break
      case 'dent':
        this.onDent(ev)
        break
      case 'hole':
        this.onHole(ev)
        break
      case 'crack':
        this.onCrack(ev)
        break
      case 'ricochet': {
        const d = ev.direction
        this.vfx.burst('sparks', ev.point, d, 4 + Math.min(10, ev.energy / 150), 4)
        this.sound('ricochet', ev.point, 0.7)
        break
      }
      case 'debris':
        this.vfx.burst(ev.kind, ev.point, ev.normal, ev.count, ev.speed > 0 ? ev.speed : DEFAULT_SPEED[ev.kind] ?? 1, this.debrisOptions(ev.kind, ev.object, ev.part))
        break
      case 'fracture':
        this.onFracture(ev)
        break
      case 'detach':
        this.onDetach(ev)
        break
      case 'settle':
        this.onSettle(ev.object)
        break
      case 'collapse':
        this.splitLoose(ev.object)
        this.playEvent({ kind: 'collapse' }, this.rootPoint(ev.object))
        break
      case 'disassemble_progress': {
        const k = `unscrew:${ev.joint}`
        if (this.time - (this.throttles.get(k) ?? -1) > 0.25) {
          this.throttles.set(k, this.time)
          this.sound('unscrew', this.rootPoint(ev.object), clamp(0.3 + ev.progress * 0.5, 0, 1))
        }
        break
      }
      case 'ignite':
        this.startFire(ev)
        this.activate(ev.object, ev.part)
        this.sound('ignite', ev.point, 0.7)
        this.sound('burn_loop', ev.point, 0.5)
        break
      case 'primed':
        // a bullet or fire sets the part burning until its delay runs out; a blast nearby only waits for the explosion
        if (ev.trigger !== 'explosion') {
          this.vfx.fire({ point: ev.point, radius: PRIMED_FIRE_RADIUS, life: ev.delay })
          this.primedBurning.add(`${ev.object}|${ev.part}`)
          this.activate(ev.object, ev.part)
          this.sound('ignite', ev.point, 0.7)
          this.sound('burn_loop', ev.point, 0.5)
        }
        break
      case 'spall':
        this.onSpall(ev)
        break
      case 'stage':
        this.onStage(ev)
        break
      case 'chip':
        this.onChip(ev)
        break
      case 'expose':
        this.cages.set(`${ev.object}|${ev.part}`, ev.bars)
        if (ev.bars.length > 0) {
          const [a, b] = ev.bars[0] as [Vec3, Vec3]
          this.playEvent({ kind: 'expose' }, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
        }
        break
      case 'extinguish': {
        const f = this.fires.get(`${ev.object}|${ev.part}`)
        const primed = this.primedBurning.delete(`${ev.object}|${ev.part}`)
        if (f) {
          this.stopFire(`${ev.object}|${ev.part}`)
          this.vfx.burst('steam', f.point, [0, 1, 0], 14, 1.2)
        }
        if (f || primed) this.sound('burn_end', f?.point ?? this.rootPoint(ev.object), 0.5)
        this.activate(ev.object, ev.part)
        this.sound('extinguish', f?.point ?? this.rootPoint(ev.object), 0.6)
        break
      }
      case 'burnout': {
        this.stopFire(`${ev.object}|${ev.part}`)
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.sound('burn_end', ev.point, 0.5)
        this.vfx.burst('ash', ev.point, [0, 1, 0], 16, 1)
        this.vfx.burst('smoke', ev.point, [0, 1, 0], 6, 0.8, { color: SMOKE_TONES.grey })
        const pv = this.partVis(ev.object, ev.part)
        if (pv) {
          const def = this.world.materials.get(pv.material)
          this.visuals.setChar(pv, 1, def?.visual?.charColor ?? 0x1a1410)
        }
        this.activate(ev.object, ev.part)
        break
      }
      case 'melt':
        this.activate(ev.object, ev.part)
        if (this.time - (this.throttles.get(`melt:${ev.object}|${ev.part}`) ?? -9) > 1.5) {
          this.throttles.set(`melt:${ev.object}|${ev.part}`, this.time)
          this.sound('melt_sizzle', this.rootPoint(ev.object), 0.4)
        }
        break
      case 'drip': {
        const b = this.bounds.get(ev.object)
        const pv = b?.parts.get(ev.part)
        const def = this.world.materials.get(ev.material)
        const color = (pv && this.partColor(pv, def)) ?? fallbackColor(ev.material, def)
        let tag = this.homeTags.indexOf(ev.object) + 1
        if (tag === 0) tag = this.homeTags.push(ev.object)
        this.vfx.spawn('drips', ev.point, [(this.rng() - 0.5) * 0.1, -0.1, (this.rng() - 0.5) * 0.1], { color, tag, owner: this.owner })
        break
      }
      case 'leak': {
        const key = `${ev.object}|${ev.part}`
        const b = this.bounds.get(ev.object)
        let localPoint: Vec3 | undefined
        let localDirection: Vec3 | undefined
        if (b) {
          b.root.updateWorldMatrix(true, false)
          const inv = new this.THREE.Matrix4().copy(b.root.matrixWorld).invert()
          const lp = this.v1.set(ev.point[0], ev.point[1], ev.point[2]).applyMatrix4(inv)
          const ld = this.v2.set(ev.direction[0], ev.direction[1], ev.direction[2]).transformDirection(inv).normalize()
          localPoint = [lp.x, lp.y, lp.z]
          localDirection = [ld.x, ld.y, ld.z]
        }
        const same = this.leaks.find((l) => l.object === ev.object && l.part === ev.part && Math.hypot(l.point[0] - ev.point[0], l.point[1] - ev.point[1], l.point[2] - ev.point[2]) < 0.03)
        if (same) {
          same.rate = ev.rate
          same.direction = ev.direction
          if (localPoint) same.localPoint = localPoint
          if (localDirection) same.localDirection = localDirection
        } else {
          if (this.leaks.length >= 24) this.leaks.shift()
          this.leaks.push({
            object: ev.object,
            part: ev.part,
            fluid: ev.fluid,
            point: ev.point,
            direction: ev.direction,
            rate: ev.rate,
            pressurized: ev.pressurized,
            acc: 0,
            opened: this.world.part(ev.object, ev.part)?.holes.some((h) => h.through) ?? false,
            localPoint,
            localDirection,
            life: 0,
          })
        }
        void key
        break
      }
      case 'explode':
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.onExplode(ev)
        break
      case 'destroyed':
        break
    }
  }

  private rootPoint(objectId: string): Vec3 {
    const b = this.bounds.get(objectId)
    return b ? [b.root.position.x, b.root.position.y, b.root.position.z] : [0, 0, 0]
  }

  private sound(key: string, point: Vec3, volume: number): void {
    this.o.onSound?.(key, point, volume)
  }

  private partVis(objectId: string, partId: string): PartVis | null {
    return this.bounds.get(objectId)?.parts.get(partId) ?? null
  }

  private activate(objectId: string, partId: string): void {
    this.active.set(`${objectId}|${partId}`, { object: objectId, part: partId })
  }

  /** Current colour of the part's first mesh (char included), or null. */
  private partColor(pv: PartVis, def: MaterialDef | undefined): number | null {
    const mv = pv.meshes[0]
    if (!mv) return null
    const mat = materialsOf(mv.mesh.material)[0] as THREE_NS.MeshStandardMaterial | undefined
    const c = mat?.color
    if (c && (c as THREE_NS.Color).isColor) {
      const tint = this.visuals.vertexTint(mv)
      return tint ? c.clone().multiply(tint).getHex() : c.getHex()
    }
    return def ? fallbackColor(def.id, def) : null
  }

  private debrisOptions(kind: DebrisKind, objectId: string, partId: string): { color?: number } | undefined {
    const pv = this.partVis(objectId, partId)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    if (kind === 'smoke') return { color: SMOKE_TONES[def?.thermal.smoke ?? 'grey'] }
    if (kind === 'fibers' || kind === 'leaves') {
      if (def?.visual?.innerColor !== undefined) return { color: def.visual.innerColor }
      const c = pv ? this.visuals.baseColorHex(pv.meshes[0] ?? ({} as never)) : -1
      return c >= 0 ? { color: c } : undefined
    }
    if (kind === 'dust' || kind === 'chips') {
      const c = pv && pv.meshes[0] ? this.visuals.baseColorHex(pv.meshes[0]) : -1
      return c >= 0 && kind === 'chips' ? { color: c } : undefined
    }
    return undefined
  }

  /** Mesh of the part closest to a world point. */
  private nearestMesh(pv: PartVis, p: THREE_NS.Vector3): PartVis['meshes'][number] | null {
    let best: PartVis['meshes'][number] | null = null
    let bd = Infinity
    for (const mv of pv.meshes) {
      if (!this.visuals.shown(mv)) continue
      const d = this.visuals.worldBox(mv, this.box).distanceToPoint(p)
      if (d < bd) {
        bd = d
        best = mv
      }
    }
    return best
  }

  private worldDir(b: Bound, v: Vec3): THREE_NS.Vector3 {
    b.root.updateWorldMatrix(true, false)
    return new this.THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(b.root.getWorldQuaternion(this.tmpQ)).normalize()
  }

  private onDent(ev: Ev<'dent'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const wp = new this.THREE.Vector3(ev.worldPoint[0], ev.worldPoint[1], ev.worldPoint[2])
    const wn = this.worldDir(b, ev.dent.normal)
    const shown = pv.meshes.filter((mv) => this.visuals.shown(mv))
    const reach = shown.reduce((widest, mv) => Math.max(widest, this.visuals.dentReach(mv, wp, ev.dent)), ev.dent.radius)
    this.visuals.applyPartDent(shown, wp, wn, ev.dent, reach)
    if (def?.tags?.includes('metal')) this.vfx.burst('sparks', ev.worldPoint, [wn.x, wn.y, wn.z], 4 + Math.min(8, ev.dent.depth * 150), 3.2)
    this.sound(impactKey(def), ev.worldPoint, clamp(0.3 + ev.dent.depth * 12, 0.3, 1))
  }

  private onHole(ev: Ev<'hole'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const n = this.worldDir(b, ev.hole.normal)
    const draw = (point: Vec3, normal: THREE_NS.Vector3): void => {
      const wp = new this.THREE.Vector3(point[0], point[1], point[2])
      const mv = this.nearestMesh(pv, wp)
      if (!mv) return
      if (def?.visual?.transparent) {
        const seed = hashNumbers(ev.time, point[0], point[1], point[2])
        this.visuals.addCrack(mv, wp, normal, 7, Math.max(0.05, ev.hole.diameter * 5), 0xe8f4ff, seed)
      } else {
        this.visuals.addHole(mv, wp, normal, ev.hole.diameter)
      }
    }
    draw(ev.worldPoint, n)
    if (ev.hole.through && ev.exitPoint) draw(ev.exitPoint, n.clone().negate())
    if (def?.tags?.includes('metal')) this.vfx.burst('sparks', ev.worldPoint, [n.x, n.y, n.z], 6, 3.5)
    this.sound(impactKey(def), ev.worldPoint, 0.6)
  }

  private onCrack(ev: Ev<'crack'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const wp = new this.THREE.Vector3(ev.worldPoint[0], ev.worldPoint[1], ev.worldPoint[2])
    const mv = this.nearestMesh(pv, wp)
    if (mv) {
      const color = def?.visual?.transparent ? 0xe8f4ff : 0x2a2724
      this.visuals.addCrack(mv, wp, this.worldDir(b, ev.crack.normal), ev.crack.rays, ev.crack.length, color, hashNumbers(ev.time, ev.worldPoint[0], ev.worldPoint[1], ev.worldPoint[2]))
    }
    this.sound(impactKey(def), ev.worldPoint, 0.5)
  }

  /** Outward normal of the face of `mv` nearest to a world point: the thin axis of its world box (right for a wall; a sloped face is left to the vertex-range binding). */
  private faceNormal(mv: PartVis['meshes'][number], point: THREE_NS.Vector3): THREE_NS.Vector3 {
    const box = this.visuals.worldBox(mv, this.box)
    const size = box.getSize(this.v1)
    const axis = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z'
    const side = point[axis] >= (box.min[axis] + box.max[axis]) / 2 ? 1 : -1
    return new this.THREE.Vector3(axis === 'x' ? side : 0, axis === 'y' ? side : 0, axis === 'z' ? side : 0)
  }

  /** The material an impact effect is chosen by: the tags of the material (`metal`, `glass`, `wood`), else stone and the like are `concrete`. */
  private impactMaterial(def: MaterialDef | undefined): string {
    for (const tag of IMPACT_TAGS) if (def?.tags?.includes(tag)) return tag
    return 'concrete'
  }

  /**
   * Plays the effect the event map names for a destruction event (`data/event-effects.json` of `game-vfx`, or `RendererOptions.eventEffects`) at a point.
   * Answers whether one played, so the caller can leave out the burst it replaces.
   */
  private playEvent(event: GameEvent, point: Vec3): boolean {
    const id = effectForEvent(event, this.o.eventEffects ?? EVENT_EFFECTS_MAP)
    if (!id) return false
    return this.vfx.play(id, point, { seed: hashNumbers(point[0], point[1], point[2], this.time) }) !== null
  }

  /** A coat came off: a patch in the colour of the core under it, below the bullet holes and cracks. */
  private onSpall(ev: Ev<'spall'>): void {
    const pv = this.partVis(ev.object, ev.part)
    if (!pv) return
    const wp = new this.THREE.Vector3(ev.point[0], ev.point[1], ev.point[2])
    const mv = this.nearestMesh(pv, wp)
    if (!mv) return
    const def = this.world.materials.get(pv.material)
    this.playEvent({ kind: 'spall', material: this.impactMaterial(def) }, ev.point)
    this.visuals.addSpall(mv, wp, this.faceNormal(mv, wp), Math.sqrt(ev.area / Math.PI), fallbackColor(pv.material, def))
  }

  /**
   * Stage 2 of a staged part: the unit-sized fragments come out and the part stays drawn (hiding it is what `fracture` does). The opening itself
   * (cutting the wall's faces) is not drawn yet: it needs the per-vertex binding of the house renderer.
   */
  private onStage(ev: Ev<'stage'>): void {
    const played = this.playEvent({ kind: 'stage', stage: ev.stage }, ev.opening?.center ?? this.rootPoint(ev.object))
    if (!ev.fragments || !ev.opening) return
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(pv?.material ?? '', def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = 0; i < ev.fragments.length; i += step) {
      const fr = ev.fragments[i] as Fragment
      const fdef = this.world.materials.get(fr.material)
      this.fragments.spawn(fr, this.fragments.materialFor(fr.material, fdef === def || !fdef ? color : fallbackColor(fr.material, fdef), false), ev.object, maxAlive)
    }
    if (!played) this.vfx.burst('dust', ev.opening.center, [0, 1, 0], 14, 1.2, { color })
    this.sound(impactKey(def), ev.opening.center, 0.8)
  }

  /**
   * A unit came out of a wall of units: the unit flies as a fragment with a puff of its dust. The gap itself is the drawing's (the house renderer redraws
   * the wall as its courses without that unit); a part drawn as one box keeps its box.
   */
  private onChip(ev: Ev<'chip'>): void {
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(pv?.material ?? '', def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    for (const fr of ev.fragments) this.fragments.spawn(fr as Fragment, this.fragments.materialFor(fr.material, fallbackColor(fr.material, def), false), ev.object, maxAlive)
    if (!this.playEvent({ kind: 'spall', material: this.impactMaterial(def) }, ev.center)) this.vfx.burst('dust', ev.center, [0, 1, 0], 6, 0.8, { color })
    this.sound(impactKey(def), ev.center, 0.7)
  }

  private onFracture(ev: Ev<'fracture'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    const matId = pv?.material || (ev.fragments[0]?.material ?? '')
    const def = this.world.materials.get(matId)
    let color = fallbackColor(matId, def)
    let opacity = 0.5
    const transparent = def?.visual?.transparent === true
    if (pv) {
      const c = this.partColor(pv, def)
      if (c !== null) color = c
      const m = pv.meshes[0] ? (materialsOf(pv.meshes[0].origMaterial)[0] as THREE_NS.Material | undefined) : undefined
      if (m && m.transparent) opacity = clamp(m.opacity, 0.2, 0.8)
      this.visuals.hide(pv, 'broken')
    }
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = 0; i < ev.fragments.length; i += step) {
      const fr = ev.fragments[i]
      const fdef = this.world.materials.get(fr.material)
      const tone = fr.inner && fdef?.visual?.innerColor !== undefined ? fdef.visual.innerColor : fdef === def || !fdef ? color : fallbackColor(fr.material, fdef)
      const mat = this.fragments.materialFor(fr.material, tone, transparent || fdef?.visual?.transparent === true, opacity)
      this.fragments.spawn(fr, mat, ev.object, maxAlive)
    }
    const up: Vec3 = [0, 1, 0]
    const sizeK = clamp(ev.fragments.length / 10, 0.5, 2)
    switch (ev.style) {
      case 'shatter':
        this.vfx.burst('shards', ev.point, up, 18 * sizeK, 3)
        break
      case 'crumble':
        this.vfx.burst('dust', ev.point, up, 16 * sizeK, 1.2, { color: pv ? (this.partColor(pv, def) ?? undefined) : undefined })
        this.vfx.burst('chips', ev.point, up, 6, 3)
        break
      case 'splinter':
        this.vfx.burst('splinters', ev.point, up, 14 * sizeK, 3)
        this.vfx.burst('dust', ev.point, up, 5, 0.8, { color: 0xb59a74 })
        break
      case 'tear':
        this.vfx.burst('fibers', ev.point, up, 12 * sizeK, 1.6, { color: def?.visual?.innerColor ?? color })
        break
      case 'snap':
        this.vfx.burst('chips', ev.point, up, 8 * sizeK, 3)
        break
      default:
        this.vfx.burst('sparks', ev.point, up, 10, 4)
    }
    this.sound(fractureKey(def, ev.style), ev.point, clamp(0.4 + ev.fragments.length * 0.03, 0.4, 1))
  }

  private onDetach(ev: Ev<'detach'>): void {
    this.sound('detach', this.rootPoint(ev.object), 0.5)
    this.splitLoose(ev.object)
  }

  /** Turn every loose group of the object (a detach, a collapse) into a piece of its own. */
  private splitLoose(objectId: string): void {
    if (!this.autoSplit) return
    const b = this.bounds.get(objectId)
    if (!b) return
    const st = this.world.state(objectId)
    if (!st || st.groups.length < 2) return
    const loose = st.groups.length - 1
    for (let i = 0; i < loose; i++) {
      // the loose groups are always read from index 1: each split renumbers the rest
      let newId: string
      try {
        newId = this.world.splitGroup(objectId, 1)
      } catch {
        break
      }
      this.adoptSplit(b, newId)
    }
    const old = b.piece
    if (old) {
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      old.halfExtents = half
      this.pieceSys.setCenter(old, center)
      old.mass = Math.max(0.05, this.massOf(objectId))
      old.sleeping = false
    }
  }

  /** The renderer side of `splitGroup`: a new group holding the meshes of the new object, made a piece. */
  private adoptSplit(from: Bound, newId: string): void {
    const state = this.world.state(newId)
    const root = from.root
    root.updateWorldMatrix(true, false)
    const group = new this.THREE.Group()
    group.name = `destruction-piece-${newId}`
    root.getWorldPosition(group.position)
    root.getWorldQuaternion(group.quaternion)
    this.scene.add(group)
    group.updateMatrixWorld(true)
    const nb: Bound = { id: newId, root: group, sync: true, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: true }
    for (const p of state?.parts ?? []) {
      const pv = from.parts.get(p.id)
      if (!pv) continue
      from.parts.delete(p.id)
      nb.parts.set(p.id, pv)
      for (const mv of pv.meshes) {
        // a part drawn by a range of a merged mesh leaves its faces behind: it gets a mesh of its own
        if (mv.host && !mv.loose) this.visuals.extract(mv, group)
        else {
          group.attach(mv.mesh)
          mv.moved = true
        }
      }
    }
    this.bounds.set(newId, nb)
    for (const pv of nb.parts.values()) this.tagPart(pv, newId)
    const meshes = this.meshesOf(nb)
    if (meshes.length === 0) return
    const { half, center } = this.measure(group, meshes)
    let vel: Vec3 = [0, 0, 0]
    let ang: Vec3 = [0, 0, 0]
    const op = from.piece
    if (op) {
      vel = [...op.velocity]
      ang = [...op.angularVelocity]
      // linear velocity at the loose piece's centre
      const c = this.pieceSys.centerOf(op, new this.THREE.Vector3())
      const nc = center.clone().applyQuaternion(group.quaternion).add(group.position)
      vel[0] += ang[1] * (nc.z - c.z) - ang[2] * (nc.y - c.y)
      vel[1] += ang[2] * (nc.x - c.x) - ang[0] * (nc.z - c.z)
      vel[2] += ang[0] * (nc.y - c.y) - ang[1] * (nc.x - c.x)
    }
    const piece = this.pieceSys.create(newId, group, half, center, this.massOf(newId), vel, ang)
    nb.piece = piece
    this.o.onPiece?.(piece)
  }

  private onExplode(ev: Ev<'explode'>, options: ExplodeOptions = {}): void {
    const p = ev.point
    if (options.visual !== false) this.playExplosion(ev, options)
    this.vfx.push(p, ev.radius, 4)
    // shove pieces and fragments
    const c = this.v1
    const report = options.report
    const confinement = report?.find((r) => r.blast !== undefined)?.blast?.confinement ?? 1
    const energy = ev.energy * confinement
    // the energy that got to an object after what stood in the way (`blast.shelter`); the whole of it when the blast carries no report
    const reachOf = (objectId: string): number => report?.find((r) => r.object === objectId)?.blast?.shelter ?? 1
    const shove = (pc: PieceBody): void => {
      this.pieceSys.centerOf(pc, c)
      const hit = blastShove({ point: p, energy, radius: ev.radius, reach: reachOf(pc.objectId) }, { position: [c.x, c.y, c.z], mass: pc.mass }, this.o.blastShove)
      if (!hit) return
      const spread = pc.halfExtents[0]
      const momentum = hit.speed * pc.mass
      this.pieceSys.impulse(pc, [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum], [c.x + (this.rng() - 0.5) * spread, c.y + spread * 0.5, c.z + (this.rng() - 0.5) * spread])
    }
    for (const pc of [...this.pieceSys.list]) shove(pc)
    if (this.o.shoveable) this.loosen(p, ev.radius, energy, reachOf)
    this.fragments.blast(p, ev.radius, Math.min(20, Math.sqrt(energy) * 0.08))
    this.sound('explode', p, clamp(0.5 + ev.radius / 10, 0.5, 1))
  }

  /** The bound objects without a piece that the host lets a blast move (`shoveable`): the ones it reaches with enough speed become pieces and get the shove. */
  private loosen(point: Vec3, radius: number, energy: number, reachOf: (objectId: string) => number): void {
    const shoveable = this.o.shoveable
    if (!shoveable) return
    for (const b of [...this.bounds.values()]) {
      if (b.piece || this.pieceSys.get(b.id) || !shoveable(b.id) || !this.world.has(b.id)) continue
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      const world = center.clone().applyQuaternion(b.root.quaternion).add(b.root.position)
      const mass = this.massOf(b.id)
      const hit = blastShove({ point, energy, radius, reach: reachOf(b.id) }, { position: [world.x, world.y, world.z], mass }, this.o.blastShove)
      if (!hit) continue
      const piece = this.makePiece(b.id, { mass })
      const body = this.pieceSys.get(b.id)
      if (!body) continue
      this.o.onLoosened?.(b.id, piece)
      const spread = half[0]
      const momentum = hit.speed * mass
      this.pieceSys.impulse(body, [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum], [world.x + (this.rng() - 0.5) * spread, world.y + spread * 0.5, world.z + (this.rng() - 0.5) * spread])
    }
  }

  private playExplosion(ev: Ev<'explode'>, options: ExplodeOptions): void {
    const named = options.effect ?? ev.effect
    const direction = options.direction
    const scale = clamp(ev.radius / GENERIC_REFERENCE_RADIUS, 0.2, 3)
    if (named !== undefined && this.vfx.explosion(named, ev.point, direction ? { direction } : {}) !== null) return
    this.vfx.explosion('generic', ev.point, { scale, ...(direction ? { direction } : {}) })
  }

  private startFire(ev: { object: string; part: string; point: Vec3 }): void {
    const key = `${ev.object}|${ev.part}`
    this.stopFire(key)
    this.fires.set(key, { object: ev.object, part: ev.part, point: ev.point, follow: { x: ev.point[0], y: ev.point[1], z: ev.point[2] } })
  }

  private stopFire(key: string): void {
    const fire = this.fires.get(key)
    if (!fire) return
    if (fire.handle !== undefined) this.vfx.stop(fire.handle)
    this.fires.delete(key)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Fire, heat, char, melt, leaks
  // ----------------------------------------------------------------------------------------------------------------------------------

  private updateActive(dt: number): void {
    this.scanTimer += dt
    if (this.scanTimer >= 0.4) {
      this.scanTimer = 0
      for (const b of this.bounds.values()) {
        for (const pv of b.parts.values()) {
          if (pv.gone !== 'none' && pv.gone !== 'broken') continue
          const ps = this.world.part(b.id, pv.id)
          if (!ps) continue
          const def = this.world.materials.get(pv.material)
          if (
            ps.burning ||
            (def?.visual?.glows && ps.temperature > GLOW_FROM_C) ||
            Math.abs(ps.char - pv.charApplied) > 0.01 ||
            Math.abs(ps.melt - pv.meltApplied) > 0.01 ||
            (pv.gone === 'none' && (ps.status === 'melted' || ps.status === 'ashes'))
          ) {
            this.activate(b.id, pv.id)
          }
        }
      }
    }
    for (const [key, a] of this.active) {
      const pv = this.partVis(a.object, a.part)
      const ps = pv ? this.world.part(a.object, a.part) : null
      if (!pv || !ps) {
        this.active.delete(key)
        continue
      }
      const def = this.world.materials.get(pv.material)
      if (pv.gone === 'none') {
        this.visuals.setChar(pv, ps.char, def?.visual?.charColor ?? 0x1a1410)
        if (def?.visual?.glows) this.visuals.setGlow(pv, ps.temperature)
        this.visuals.setMelt(pv, ps.melt)
        if (ps.status === 'melted') this.onGone(a.object, pv, 'melted', def)
        else if (ps.status === 'ashes') this.onGone(a.object, pv, 'ashes', def)
      }
      const fire = this.fires.get(key)
      if (fire) {
        if (ps.burning && ps.status !== 'broken' && ps.status !== 'ashes' && ps.status !== 'melted') this.emitFire(fire, pv, def)
        else this.stopFire(key)
      }
      const hot = def?.visual?.glows === true && ps.temperature > GLOW_FROM_C
      if (!ps.burning && !hot && Math.abs(ps.char - pv.charApplied) < 0.01 && Math.abs(ps.melt - pv.meltApplied) < 0.01) {
        if (def?.visual?.glows && pv.gone === 'none') this.visuals.setGlow(pv, 0)
        this.active.delete(key)
      }
    }
  }

  private onGone(objectId: string, pv: PartVis, reason: 'melted' | 'ashes', def: MaterialDef | undefined): void {
    const bb = new this.THREE.Box3()
    for (const mv of pv.meshes) bb.union(this.visuals.worldBox(mv, this.box))
    this.visuals.hide(pv, reason)
    if (bb.isEmpty()) return
    const c = bb.getCenter(new this.THREE.Vector3())
    const s = bb.getSize(new this.THREE.Vector3())
    const footprint = Math.sqrt(Math.max(s.x * s.z, 1e-4))
    if (reason === 'melted') {
      this.ground.add('puddle', c.x, c.z, clamp(footprint * 0.55, 0.05, 1), this.partColor(pv, def) ?? fallbackColor(pv.material, def), objectId)
    } else {
      this.ground.add('ash', c.x, c.z, clamp(footprint * 0.35, 0.04, 0.5), 0x1d1a18, objectId)
      this.vfx.burst('ash', [c.x, bb.max.y, c.z], [0, 1, 0], 10, 0.8)
    }
  }

  private emitFire(f: FireEmitter, pv: PartVis, def: MaterialDef | undefined): void {
    const bb = this.box
    bb.makeEmpty()
    const tmp = new this.THREE.Box3()
    for (const mv of pv.meshes) if (this.visuals.shown(mv)) bb.union(this.visuals.worldBox(mv, tmp))
    if (!bb.isEmpty()) {
      const c = bb.getCenter(this.v1)
      f.follow.x = c.x
      f.follow.y = bb.min.y
      f.follow.z = c.z
    }
    if (f.handle !== undefined) return
    const size = bb.isEmpty() ? this.v2.set(0.2, 0.2, 0.2) : bb.getSize(this.v2)
    const radius = clamp(Math.max(size.x, size.z) * 0.5, 0.12, 1.2)
    const smokeColor = SMOKE_TONES[def?.thermal.smoke ?? 'grey']
    f.handle = this.vfx.fire({ point: [f.follow.x, f.follow.y, f.follow.z], radius, life: FIRE_CEILING_SECONDS, follow: f.follow, ...(smokeColor !== undefined ? { smokeColor } : {}) })
  }

  private updateLeaks(dt: number): void {
    for (let i = this.leaks.length - 1; i >= 0; i--) {
      const l = this.leaks[i]
      const b = this.bounds.get(l.object)
      const ps = this.world.part(l.object, l.part)
      // a leak ends when the container is empty or the opening is closed (a valve shut, `seal`)
      if (!b || !ps || ps.liters === undefined || ps.liters <= 1e-4 || (l.opened && !ps.holes.some((h) => h.through))) {
        this.leaks.splice(i, 1)
        continue
      }
      l.life = (l.life ?? 0) + dt
      if (l.pressurized && l.life > 0.8) l.pressurized = false

      if (l.lastLiters !== undefined && Math.abs(ps.liters - l.lastLiters) < 1e-5) {
        l.idleSeconds = (l.idleSeconds ?? 0) + dt
        if (l.idleSeconds > 0.4) {
          this.leaks.splice(i, 1)
          continue
        }
      } else {
        l.idleSeconds = 0
        l.lastLiters = ps.liters
      }

      let pt = l.point
      let dir = l.direction
      if (l.localPoint && l.localDirection) {
        b.root.updateWorldMatrix(true, false)
        const wp = this.v1.set(l.localPoint[0], l.localPoint[1], l.localPoint[2]).applyMatrix4(b.root.matrixWorld)
        const wd = this.v2.set(l.localDirection[0], l.localDirection[1], l.localDirection[2]).transformDirection(b.root.matrixWorld).normalize()
        pt = [wp.x, wp.y, wp.z]
        dir = [wd.x, wd.y, wd.z]
        l.point = pt
        l.direction = dir
      }

      l.acc += clamp(20 + l.rate * 400, 15, 120) * dt
      const color = FLUID_COLORS[l.fluid] ?? 0xaaaaaa
      const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
      const sp = l.pressurized ? 2.5 + this.rng() * 1.5 : 0.3 + this.rng() * 0.3
      while (l.acc >= 1) {
        l.acc -= 1
        const vel: Vec3 = [(dir[0] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[1] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[2] / dl) * sp + (this.rng() - 0.5) * 0.25]
        if (l.fluid === 'gas') this.vfx.spawn('steam', pt, vel, { color, size: 0.5, alpha: 0.5 })
        else this.vfx.spawn('drips', pt, vel, { color, tag: this.rng() < 0.03 ? this.tagOf(l.object) : 0, owner: this.owner })
      }
    }
  }

  private tagOf(object: string): number {
    let tag = this.homeTags.indexOf(object) + 1
    if (tag === 0) tag = this.homeTags.push(object)
    return tag
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Emit, clear, restore, stats, dispose
  // ----------------------------------------------------------------------------------------------------------------------------------

  emit(kind: DebrisKind | 'fire' | 'flash' | 'foam', point: Vec3, normal: Vec3, count: number, speed?: number): void {
    this.vfx.burst(kind, point, normal, count, speed ?? DEFAULT_SPEED[kind] ?? 1, kind === 'smoke' ? { color: SMOKE_TONES.grey } : undefined)
  }

  explode(point: Vec3, energy: number, radius: number, options?: ExplodeOptions): void {
    this.onExplode({ type: 'explode', object: '', part: '', time: this.time, point, energy, radius }, options)
  }

  restore(objectId: string): void {
    const homes = new Set<string>([objectId])
    const self = this.bounds.get(objectId)
    if (self?.isSplit) for (const pv of self.parts.values()) homes.add(pv.home)
    for (const home of homes) this.restoreHome(home)
    for (const [key, a] of [...this.active]) if (homes.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (homes.has(f.object)) this.stopFire(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (homes.has(this.leaks[i].object)) this.leaks.splice(i, 1)
    for (const home of homes) {
      this.fragments.removeHome(home)
      this.ground.removeHome(home)
      this.cages.removeObject(home)
    }
  }

  private restoreHome(home: string): void {
    const homeBound = this.bounds.get(home)
    for (const b of [...this.bounds.values()]) {
      for (const [pid, pv] of [...b.parts]) {
        if (pv.home !== home) continue
        this.visuals.restorePart(pv)
        this.tagPart(pv, home)
        if (b !== homeBound && homeBound) {
          b.parts.delete(pid)
          homeBound.parts.set(pid, pv)
        }
      }
      if (b.isSplit && b.parts.size === 0) {
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.bounds.delete(b.id)
      }
    }
  }

  clear(): void {
    this.queue.length = 0
    this.active.clear()
    for (const key of [...this.fires.keys()]) this.stopFire(key)
    this.leaks.length = 0
    for (const id of [...this.bounds.keys()]) if (this.bounds.has(id)) this.restore(id)
    // anything left of a split object whose home is gone
    for (const b of [...this.bounds.values()]) {
      if (b.isSplit) {
        for (const pv of b.parts.values()) this.visuals.restorePart(pv)
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.bounds.delete(b.id)
      }
    }
    this.fragments.clear()
    this.ground.clear()
    this.cages.clear()
    this.primedBurning.clear()
    this.vfx.sprites().clear()
    this.ownVfx?.world.clear()
  }

  stats(): { fragments: number; particles: number; pieces: number; decals: number } {
    return { fragments: this.fragments.count, particles: this.vfx.sprites().live + this.ownedVfxParticles(), pieces: this.pieceSys.list.length, decals: this.visuals.decalCount + this.ground.count }
  }

  private ownedVfxParticles(): number {
    if (!this.ownVfx) return 0
    const { puffs, sparks, glows, chunks } = this.vfx.stats()
    return puffs + sparks + glows + chunks
  }

  // The last warm-up keeps its materials until the next one: a material that does not use lights keeps the program of the lights it was first drawn with, so each warm-up needs materials of its own.
  private warmProbes: { readonly group: THREE_NS.Group; readonly geometry: THREE_NS.BufferGeometry; readonly materials: THREE_NS.Material[] } | undefined

  warmUpProbes(): WarmUpProbes {
    this.releaseWarmProbes()
    const { kit } = this.visuals
    const T = this.THREE
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
    const materials = [kit.discMaterial().clone(), kit.patchMaterial(0x808080).clone(), kit.lineMaterial(0x000000).clone()]
    const group = new T.Group()
    group.add(new T.Mesh(kit.discGeometry(), materials[0]), new T.Mesh(kit.discGeometry(), materials[1]), new T.LineSegments(geometry, materials[2] as THREE_NS.LineBasicMaterial))
    for (const probe of group.children) probe.frustumCulled = false
    this.warmProbes = { group, geometry, materials }
    return { group, dispose: () => {} }
  }

  private releaseWarmProbes(): void {
    if (!this.warmProbes) return
    this.warmProbes.geometry.dispose()
    for (const material of this.warmProbes.materials) material.dispose()
    this.warmProbes = undefined
  }

  rebarCount(): number {
    return this.cages.count
  }

  dispose(): void {
    this.releaseWarmProbes()
    if (this.disposed) return
    this.unsubscribe()
    this.clear()
    for (const id of [...this.bounds.keys()]) this.unbind(id)
    this.fragments.dispose()
    this.ground.dispose()
    this.cages.dispose()
    this.stopLanding()
    this.visuals.dispose()
    this.ownVfx?.dispose()
    this.disposed = true
  }
}
