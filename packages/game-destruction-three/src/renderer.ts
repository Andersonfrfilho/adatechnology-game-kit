import type * as THREE_NS from 'three'
import type { DebrisKind, DestructionEvent, MaterialDef, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { FragmentSystem } from './fragments'
import { GroundSpots } from './ground'
import type { Bound, PartVis, PieceBody } from './internal'
import { clamp, createRng, hashNumbers, hashString, mixHex } from './math'
import { ParticleSystem } from './particles'
import type { ParticleKind } from './particles'
import { PieceSystem } from './pieces'
import type { DestructionRenderer, BindOptions, Mesh, Object3D, Piece, RendererOptions, ThreeNamespace } from './types'
import { Visuals } from './visual'

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>

const GLOW_FROM_C = 430
const QUEUE_CAP = 4000

interface FireEmitter {
  object: string
  part: string
  point: Vec3
  accFire: number
  accSmoke: number
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
}

const FLUID_COLORS: Record<string, number> = {
  water: 0x8cc8ff,
  fuel: 0xd9a032,
  oil: 0x2a2018,
  gas: 0xf2f2f2,
  sap: 0xb89b3a,
  acid: 0x9bd23c,
  blood: 0x8a0a0a,
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
  private readonly particles: ParticleSystem
  private readonly fragments: FragmentSystem
  private readonly ground: GroundSpots
  private readonly pieceSys: PieceSystem
  private readonly active = new Map<string, { object: string; part: string }>()
  private readonly fires = new Map<string, FireEmitter>()
  private readonly leaks: Leak[] = []
  private readonly homeTags: string[] = []
  private readonly throttles = new Map<string, number>()
  private readonly rng = createRng(0xc0ffee)
  private light: THREE_NS.PointLight | null = null
  private lightT = 0
  private lightDur = 0.3
  private lightPeak = 0
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
    this.particles = new ParticleSystem(THREE, {
      capacity: maxParticles,
      scene: o.scene,
      density: this.low ? 0.6 : 1,
      pointScale: o.pointScale ?? 700,
      groundAt: this.groundAt,
      gravity: this.gravity,
      onLand: (x, _y, z, color, tag) => {
        const home = this.homeTags[tag - 1] ?? ''
        this.ground.add('puddle', x, z, 0.05 + this.rng() * 0.04, color, home)
      },
    })
    this.fragments = new FragmentSystem(THREE, {
      scene: o.scene,
      groundAt: this.groundAt,
      gravity: this.gravity,
      max: this.maxFragments,
      life: o.fragmentLife ?? 12,
    })
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
    const byPart = new Map<string, Mesh[]>()
    const taken = new Set<Mesh>()
    const add = (pid: string, m: Mesh): void => {
      if (taken.has(m)) return
      taken.add(m)
      const l = byPart.get(pid)
      if (l) l.push(m)
      else byPart.set(pid, [m])
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
        for (const o of Array.isArray(v) ? v : [v]) for (const m of meshesIn(o)) add(pid, m)
      }
    } else {
      const leftovers: Mesh[] = []
      for (const m of meshesIn(root)) {
        const ud = m.userData?.destructionPart
        if (typeof ud === 'string' && partIds.has(ud)) add(ud, m)
        else if (partIds.has(m.name)) add(m.name, m)
        else leftovers.push(m)
      }
      if (leftovers.length) this.matchByBox(objectId, root, leftovers, add)
    }
    const bound: Bound = { id: objectId, root, sync: options.syncTransform !== false, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: false }
    for (const pid of partIds) bound.parts.set(pid, this.makePartVis(objectId, pid, state?.parts.find((p) => p.id === pid)?.material ?? '', byPart.get(pid) ?? []))
    for (const [pid, meshes] of byPart) {
      if (!bound.parts.has(pid)) bound.parts.set(pid, this.makePartVis(objectId, pid, this.world.part(objectId, pid)?.material ?? '', meshes))
    }
    this.bounds.set(objectId, bound)
  }

  private makePartVis(home: string, id: string, material: string, meshes: Mesh[]): PartVis {
    return { id, home, material, meshes: meshes.map((m) => this.visuals.makeMeshVis(m, home)), charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' }
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
    root.updateMatrixWorld(true)
    const e = new this.THREE.Euler()
    const q = new this.THREE.Quaternion()
    for (const m of meshes) {
      this.box.setFromObject(m)
      if (this.box.isEmpty()) continue
      const c = root.worldToLocal(this.box.getCenter(this.v1))
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

  /** Half extents and centre of the box around some meshes, in the local space of `root`. */
  private measure(root: Object3D, meshes: Mesh[]): { half: Vec3; center: THREE_NS.Vector3 } {
    root.updateMatrixWorld(true)
    const inv = root.matrixWorld.clone().invert()
    const total = new this.THREE.Box3()
    const m4 = new this.THREE.Matrix4()
    for (const m of meshes) {
      const g = m.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      if (!g.boundingBox || g.boundingBox.isEmpty()) continue
      total.union(g.boundingBox.clone().applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld)))
    }
    if (total.isEmpty()) return { half: [0.25, 0.25, 0.25], center: new this.THREE.Vector3() }
    const size = total.getSize(new this.THREE.Vector3())
    return { half: [Math.max(0.02, size.x / 2), Math.max(0.02, size.y / 2), Math.max(0.02, size.z / 2)], center: total.getCenter(new this.THREE.Vector3()) }
  }

  private meshesOf(b: Bound): Mesh[] {
    const out: Mesh[] = []
    for (const pv of b.parts.values()) if (pv.gone === 'none') for (const mv of pv.meshes) out.push(mv.mesh)
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
    this.updateActive(dt)
    this.updateLeaks(dt)
    this.pieceSys.update(dt)
    this.fragments.update(dt)
    this.ground.update(dt)
    this.updateLight(dt)
    this.particles.update(dt)
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
        this.particles.burst('sparks', ev.point, d, 4 + Math.min(10, ev.energy / 150), 4)
        this.sound('ricochet', ev.point, 0.7)
        break
      }
      case 'debris':
        this.particles.burst(ev.kind, ev.point, ev.normal, ev.count, ev.speed > 0 ? ev.speed : DEFAULT_SPEED[ev.kind] ?? 1, this.debrisOptions(ev.kind, ev.object, ev.part))
        break
      case 'fracture':
        this.onFracture(ev)
        break
      case 'detach':
        this.onDetach(ev)
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
        this.fires.set(`${ev.object}|${ev.part}`, { object: ev.object, part: ev.part, point: ev.point, accFire: 0, accSmoke: 0 })
        this.activate(ev.object, ev.part)
        this.particles.burst('fire', ev.point, [0, 1, 0], 6, 1)
        this.sound('ignite', ev.point, 0.7)
        this.sound('burn_loop', ev.point, 0.5)
        break
      case 'extinguish': {
        const f = this.fires.get(`${ev.object}|${ev.part}`)
        if (f) {
          this.fires.delete(`${ev.object}|${ev.part}`)
          this.particles.burst('steam', f.point, [0, 1, 0], 14, 1.2)
        }
        this.activate(ev.object, ev.part)
        this.sound('extinguish', f?.point ?? this.rootPoint(ev.object), 0.6)
        break
      }
      case 'burnout': {
        this.fires.delete(`${ev.object}|${ev.part}`)
        this.particles.burst('ash', ev.point, [0, 1, 0], 16, 1)
        this.particles.burst('smoke', ev.point, [0, 1, 0], 6, 0.8, { color: SMOKE_TONES.grey })
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
        this.particles.spawn('drips', ev.point, [(this.rng() - 0.5) * 0.1, -0.1, (this.rng() - 0.5) * 0.1], { color, tag })
        break
      }
      case 'leak': {
        const key = `${ev.object}|${ev.part}`
        const same = this.leaks.find((l) => l.object === ev.object && l.part === ev.part && Math.hypot(l.point[0] - ev.point[0], l.point[1] - ev.point[1], l.point[2] - ev.point[2]) < 0.03)
        if (same) {
          same.rate = ev.rate
          same.direction = ev.direction
        } else {
          if (this.leaks.length >= 24) this.leaks.shift()
          this.leaks.push({ object: ev.object, part: ev.part, fluid: ev.fluid, point: ev.point, direction: ev.direction, rate: ev.rate, pressurized: ev.pressurized, acc: 0 })
        }
        void key
        break
      }
      case 'explode':
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
      if (!mv.mesh.visible) continue
      const d = this.box.setFromObject(mv.mesh).distanceToPoint(p)
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
    for (const mv of pv.meshes) {
      if (!mv.mesh.visible) continue
      this.visuals.applyDent(mv, wp, wn, ev.dent)
    }
    if (def?.tags?.includes('metal')) this.particles.burst('sparks', ev.worldPoint, [wn.x, wn.y, wn.z], 4 + Math.min(8, ev.dent.depth * 150), 3.2)
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
    if (def?.tags?.includes('metal')) this.particles.burst('sparks', ev.worldPoint, [n.x, n.y, n.z], 6, 3.5)
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
      const mat = this.fragments.materialFor(fr.material, fdef === def || !fdef ? color : fallbackColor(fr.material, fdef), transparent || fdef?.visual?.transparent === true, opacity)
      this.fragments.spawn(fr, mat, ev.object, maxAlive)
    }
    const up: Vec3 = [0, 1, 0]
    const sizeK = clamp(ev.fragments.length / 10, 0.5, 2)
    switch (ev.style) {
      case 'shatter':
        this.particles.burst('shards', ev.point, up, 18 * sizeK, 3)
        break
      case 'crumble':
        this.particles.burst('dust', ev.point, up, 16 * sizeK, 1.2, { color: pv ? (this.partColor(pv, def) ?? undefined) : undefined })
        this.particles.burst('chips', ev.point, up, 6, 3)
        break
      case 'splinter':
        this.particles.burst('splinters', ev.point, up, 14 * sizeK, 3)
        this.particles.burst('dust', ev.point, up, 5, 0.8, { color: 0xb59a74 })
        break
      case 'tear':
        this.particles.burst('fibers', ev.point, up, 12 * sizeK, 1.6, { color: color })
        break
      case 'snap':
        this.particles.burst('chips', ev.point, up, 8 * sizeK, 3)
        break
      default:
        this.particles.burst('sparks', ev.point, up, 10, 4)
    }
    this.sound(fractureKey(def, ev.style), ev.point, clamp(0.4 + ev.fragments.length * 0.03, 0.4, 1))
  }

  private onDetach(ev: Ev<'detach'>): void {
    this.sound('detach', this.rootPoint(ev.object), 0.5)
    if (!this.autoSplit) return
    const b = this.bounds.get(ev.object)
    if (!b) return
    const st = this.world.state(ev.object)
    if (!st || st.groups.length < 2) return
    const loose = st.groups.length - 1
    for (let i = 0; i < loose; i++) {
      // the loose groups are always read from index 1: each split renumbers the rest
      let newId: string
      try {
        newId = this.world.splitGroup(ev.object, 1)
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
      old.mass = Math.max(0.05, this.massOf(ev.object))
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
        group.attach(mv.mesh)
        mv.moved = true
      }
    }
    this.bounds.set(newId, nb)
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

  private onExplode(ev: Ev<'explode'>): void {
    const p = ev.point
    const k = clamp(ev.radius / 3, 0.4, 2.5)
    this.particles.burst('flash', p, [0, 1, 0], 1, 0, { size: k })
    this.particles.burst('fire', p, [0, 1, 0], 34 * k, 4 * k, { size: 1 + k * 0.5 })
    this.particles.burst('smoke', p, [0, 1, 0], 24 * k, 2.2, { color: SMOKE_TONES.black, size: 1 + k * 0.6 })
    this.particles.burst('dust', p, [0, 1, 0], 22 * k, 3.5 * k)
    this.particles.burst('sparks', p, [0, 1, 0], 16 * k, 8)
    this.particles.push(p, ev.radius, 4)
    if (this.o.explosionLight !== false) {
      if (!this.light) {
        this.light = new this.THREE.PointLight(0xffa860, 0, 10, 2)
        this.light.name = 'destruction-explosion-light'
      }
      if (!this.light.parent) this.scene.add(this.light)
      this.light.position.set(p[0], p[1] + 0.5, p[2])
      this.light.distance = Math.max(6, ev.radius * 3)
      this.lightPeak = clamp(Math.sqrt(Math.max(1, ev.energy)) * 0.6, 10, 400)
      this.lightDur = 0.35
      this.lightT = this.lightDur
    }
    // shove pieces and fragments
    const c = this.v1
    for (const pc of this.pieceSys.list) {
      this.pieceSys.centerOf(pc, c)
      const dx = c.x - p[0]
      const dy = c.y - p[1]
      const dz = c.z - p[2]
      const d = Math.hypot(dx, dy, dz)
      if (d > ev.radius) continue
      const fall = (1 - d / ev.radius) ** 2
      const speed = Math.min(30, Math.sqrt((2 * ev.energy * 0.02) / pc.mass)) * fall
      const inv = d > 1e-4 ? 1 / d : 0
      const dir: Vec3 = d > 1e-4 ? [dx * inv, dy * inv + 0.3, dz * inv] : [0, 1, 0]
      const spread = pc.halfExtents[0]
      this.pieceSys.impulse(pc, [dir[0] * speed * pc.mass, dir[1] * speed * pc.mass, dir[2] * speed * pc.mass], [c.x + (this.rng() - 0.5) * spread, c.y + spread * 0.5, c.z + (this.rng() - 0.5) * spread])
    }
    this.fragments.blast(p, ev.radius, Math.min(20, Math.sqrt(ev.energy) * 0.08))
    this.sound('explode', p, clamp(0.5 + ev.radius / 10, 0.5, 1))
  }

  private updateLight(dt: number): void {
    if (!this.light || this.lightT <= 0) return
    this.lightT = Math.max(0, this.lightT - dt)
    const t = this.lightT / this.lightDur
    this.light.intensity = this.lightPeak * t * t
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
        if (ps.burning && ps.status !== 'broken' && ps.status !== 'ashes' && ps.status !== 'melted') this.emitFire(fire, pv, def, dt)
        else this.fires.delete(key)
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
    for (const mv of pv.meshes) bb.union(this.box.setFromObject(mv.mesh))
    this.visuals.hide(pv, reason)
    if (bb.isEmpty()) return
    const c = bb.getCenter(new this.THREE.Vector3())
    const s = bb.getSize(new this.THREE.Vector3())
    const footprint = Math.sqrt(Math.max(s.x * s.z, 1e-4))
    if (reason === 'melted') {
      this.ground.add('puddle', c.x, c.z, clamp(footprint * 0.55, 0.05, 1), this.partColor(pv, def) ?? fallbackColor(pv.material, def), objectId)
    } else {
      this.ground.add('ash', c.x, c.z, clamp(footprint * 0.35, 0.04, 0.5), 0x1d1a18, objectId)
      this.particles.burst('ash', [c.x, bb.max.y, c.z], [0, 1, 0], 10, 0.8)
    }
  }

  private emitFire(f: FireEmitter, pv: PartVis, def: MaterialDef | undefined, dt: number): void {
    const bb = this.box
    bb.makeEmpty()
    const tmp = new this.THREE.Box3()
    for (const mv of pv.meshes) if (mv.mesh.visible) bb.union(tmp.setFromObject(mv.mesh))
    let cx = f.point[0]
    let cy = f.point[1]
    let cz = f.point[2]
    let sx = 0.2
    let sy = 0.2
    let sz = 0.2
    if (!bb.isEmpty()) {
      const c = bb.getCenter(this.v1)
      const s = bb.getSize(this.v2)
      cx = c.x
      cy = bb.min.y
      cz = c.z
      sx = s.x
      sy = s.y
      sz = s.z
    }
    const vol = clamp(Math.cbrt(Math.max(sx * sy * sz, 1e-5)), 0.05, 1.5)
    f.accFire += (18 + 70 * vol) * dt
    f.accSmoke += (6 + 24 * vol) * dt
    const tone = SMOKE_TONES[def?.thermal.smoke ?? 'grey']
    const rnd = this.rng
    while (f.accFire >= 1) {
      f.accFire -= 1
      this.particles.spawn('fire', [cx + (rnd() - 0.5) * sx, cy + sy * (0.3 + 0.7 * rnd()), cz + (rnd() - 0.5) * sz], [(rnd() - 0.5) * 0.4, 0.5 + rnd() * 0.9, (rnd() - 0.5) * 0.4], { size: 0.6 + vol * 0.8 })
    }
    while (f.accSmoke >= 1) {
      f.accSmoke -= 1
      this.particles.spawn('smoke', [cx + (rnd() - 0.5) * sx, cy + sy * (0.8 + 0.4 * rnd()), cz + (rnd() - 0.5) * sz], [(rnd() - 0.5) * 0.3 + 0.1, 0.4 + rnd() * 0.5, (rnd() - 0.5) * 0.3], { color: tone, size: 0.6 + vol })
    }
  }

  private updateLeaks(dt: number): void {
    for (let i = this.leaks.length - 1; i >= 0; i--) {
      const l = this.leaks[i]
      const ps = this.world.part(l.object, l.part)
      if (!ps || ps.liters === undefined || ps.liters <= 0) {
        this.leaks.splice(i, 1)
        continue
      }
      l.acc += clamp(20 + l.rate * 400, 15, 120) * dt
      const color = FLUID_COLORS[l.fluid] ?? 0xaaaaaa
      const d = l.direction
      const dl = Math.hypot(d[0], d[1], d[2]) || 1
      const sp = l.pressurized ? 2.5 + this.rng() * 1.5 : 0.3 + this.rng() * 0.3
      while (l.acc >= 1) {
        l.acc -= 1
        const vel: Vec3 = [(d[0] / dl) * sp + (this.rng() - 0.5) * 0.25, (d[1] / dl) * sp + (this.rng() - 0.5) * 0.25, (d[2] / dl) * sp + (this.rng() - 0.5) * 0.25]
        if (l.fluid === 'gas') this.particles.spawn('steam', l.point, vel, { color, size: 0.5, alpha: 0.5 })
        else this.particles.spawn('drips', l.point, vel, { color, tag: this.rng() < 0.03 ? this.tagOf(l.object) : 0 })
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
    this.particles.burst(kind as ParticleKind, point, normal, count, speed ?? DEFAULT_SPEED[kind] ?? 1, kind === 'smoke' ? { color: SMOKE_TONES.grey } : undefined)
  }

  restore(objectId: string): void {
    const homes = new Set<string>([objectId])
    const self = this.bounds.get(objectId)
    if (self?.isSplit) for (const pv of self.parts.values()) homes.add(pv.home)
    for (const home of homes) this.restoreHome(home)
    for (const [key, a] of [...this.active]) if (homes.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (homes.has(f.object)) this.fires.delete(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (homes.has(this.leaks[i].object)) this.leaks.splice(i, 1)
    for (const home of homes) {
      this.fragments.removeHome(home)
      this.ground.removeHome(home)
    }
  }

  private restoreHome(home: string): void {
    const homeBound = this.bounds.get(home)
    for (const b of [...this.bounds.values()]) {
      for (const [pid, pv] of [...b.parts]) {
        if (pv.home !== home) continue
        this.visuals.restorePart(pv)
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
    this.fires.clear()
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
    this.particles.clear()
    if (this.light) {
      this.light.intensity = 0
      this.lightT = 0
      this.scene.remove(this.light)
    }
  }

  stats(): { fragments: number; particles: number; pieces: number; decals: number } {
    return { fragments: this.fragments.count, particles: this.particles.live, pieces: this.pieceSys.list.length, decals: this.visuals.decalCount + this.ground.count }
  }

  dispose(): void {
    if (this.disposed) return
    this.unsubscribe()
    this.clear()
    for (const id of [...this.bounds.keys()]) this.unbind(id)
    this.fragments.dispose()
    this.ground.dispose()
    this.particles.dispose()
    this.visuals.dispose()
    this.light?.dispose?.()
    this.light = null
    this.disposed = true
  }
}
