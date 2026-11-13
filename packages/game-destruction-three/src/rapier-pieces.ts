import * as RAPIER from '@dimforge/rapier3d-deterministic-compat'
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-deterministic-compat'
import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { PieceBody, PieceFriction } from './internal'
import { apartKey } from './pieces'
import type { PieceSweepHit } from './pieces'

let ready = false
let pending: Promise<void> | null = null

/** Loads the physics engine (WebAssembly, inlined): until it is ready the pieces step on the kit's own solver. */
export const initPiecePhysics = (): Promise<void> =>
  (pending ??= RAPIER.init().then(() => {
    ready = true
  }))

export const piecePhysicsReady = (): boolean => ready

export interface RapierPieceOptions {
  readonly groundAt: (x: number, z: number) => number
  readonly gravity: number
  readonly maxAwake?: number
  /** The boxes of what does not move, per object: the box around them all, then each box (min x, y, z, max x, y, z). */
  readonly staticBoxes?: () => ReadonlyMap<string, readonly number[]>
  readonly sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  readonly onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  readonly onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
}

/** Longest step the engine takes (s): an update is split into equal steps no longer than it. At 1/60 a crate dropped 2 m sinks 8 cm into the floor before it is pushed out. */
const MAX_STEP = 1 / 120
/** Side of a tile of the ground (m) and of its cells: a heightfield sampled from `groundAt`. */
const TILE = 4
const CELLS = 40
/** How far (m) around a moving piece the ground is laid. */
const TILE_MARGIN = 0.5
const MU_STATIC = 0.7
const ROLLING_RESISTANCE = 0.015
const STILL_SPEED = 0.12
const STILL_SPIN = 0.45
const HARD_LANDING = 3
const SLAM_MIN_SPEED = 2
const SLAM_BOUNCE = 0.2
const SLAM_FLOOR_NORMAL = 0.7
const TIP_ACCELERATION = 30
const TIP_LYING = 0.25
/** A support narrower than this share of the height of the centre of mass is a balancing act, and the push (rad/s^2 per metre of height) that ends it (`topple`). */
const NARROW = 0.3
const TOPPLE = 3
/** Fastest (m/s) a step's contacts may send a piece up (`noLaunch`): under 0.05 by what float32 rounds it to. */
const MOST_UP_SPEED = 0.049

interface Link {
  readonly rb: RigidBody
  colliders: Collider[]
  /** What the colliders were made from: made again when any changes. */
  shape: readonly unknown[]
  /** The state written back last: what differs on the piece was changed from outside (moved, pushed, picked up). */
  readonly pos: number[]
  readonly quat: number[]
  readonly vel: number[]
  readonly ang: number[]
  held: boolean
}

interface Tile {
  collider: Collider
  heights: Float32Array
  dirty: boolean
}

/**
 * Steps the loose pieces with Rapier: each piece a dynamic body at its centre of mass, its parts' boxes (or its box, or its round shape) as colliders, its mass and inertia
 * as the kit measures them. The ground is a heightfield of `groundAt` in tiles laid around what moves and sampled again when the region is told it changed (`wakeRegion`);
 * the fixed boxes the host reports are fixed cuboids. The kit's rules stay on top: sweep against walls, tipping, rolling resistance, sleeping, the budget of awake pieces.
 */
export class RapierPieces {
  private readonly world: World
  private readonly links = new Map<PieceBody, Link>()
  private readonly tiles = new Map<string, Tile>()
  private readonly statics = new Map<string, { boxes: readonly number[]; colliders: Collider[] }>()
  private readonly v: THREE_NS.Vector3
  private readonly q: THREE_NS.Quaternion
  /** The piece each collider belongs to (its handle), for the hook. */
  private readonly owner = new Map<number, string>()
  private apart: ReadonlySet<string> = new Set()
  private readonly events = new RAPIER.EventQueue(false)
  private readonly hooks: RAPIER.PhysicsHooks = {
    filterContactPair: (c1, c2) => {
      const a = this.owner.get(c1)
      const b = this.owner.get(c2)
      return a !== undefined && b !== undefined && this.apart.has(apartKey(a, b)) ? null : RAPIER.SolverFlags.COMPUTE_IMPULSE
    },
    filterIntersectionPair: () => true,
  }

  constructor(
    THREE: typeof THREE_NS,
    private readonly o: RapierPieceOptions,
  ) {
    this.world = new RAPIER.World({ x: 0, y: -o.gravity, z: 0 })
    this.v = new THREE.Vector3()
    this.q = new THREE.Quaternion()
  }

  remove(b: PieceBody): void {
    const link = this.links.get(b)
    if (!link) return
    for (const c of link.colliders) this.owner.delete(c.handle)
    this.world.removeRigidBody(link.rb)
    this.links.delete(b)
  }

  clear(): void {
    for (const b of [...this.links.keys()]) this.remove(b)
    for (const t of this.tiles.values()) this.world.removeCollider(t.collider, false)
    this.tiles.clear()
    for (const s of this.statics.values()) for (const c of s.colliders) this.world.removeCollider(c, false)
    this.statics.clear()
  }

  dispose(): void {
    this.events.free()
    this.world.free()
  }

  /** The ground under the disc changed: its tiles are sampled again before the next step. */
  groundChanged(x: number, z: number, radius: number): void {
    for (const [key, tile] of this.tiles) {
      const [ix, iz] = key.split(',').map(Number)
      const nx = Math.max(ix * TILE, Math.min(x, (ix + 1) * TILE))
      const nz = Math.max(iz * TILE, Math.min(z, (iz + 1) * TILE))
      if (Math.hypot(nx - x, nz - z) <= radius) tile.dirty = true
    }
  }

  /** A step of `dt`; the pairs in `apart` (`apartKey`) do not meet: the kit puts them apart along the ground. */
  update(list: readonly PieceBody[], dt: number, time: number, apart: ReadonlySet<string> = new Set()): void {
    if (dt <= 0) return
    for (const b of list) this.sync(b, dt)
    this.filterApart(list, apart)
    for (const [b] of this.links) if (!list.includes(b)) this.remove(b)
    this.layGround(list)
    this.layStatics()
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-9))
    this.world.timestep = dt / steps
    const before = new Map<PieceBody, { c: Vec3; vy: number }>()
    for (const b of list) {
      if (b.held || b.sleeping) continue
      const t = this.links.get(b)?.rb.translation()
      if (t) before.set(b, { c: [t.x, t.y, t.z], vy: b.velocity[1] })
    }
    // a piece asleep at the start had no speed up: woken in the step, it gets none from the contacts either
    const rising = new Map<PieceBody, number>()
    for (const b of list) rising.set(b, before.get(b)?.vy ?? 0)
    for (let i = 0; i < steps; i++) {
      // the bindings only call the hooks of a step given an event queue
      this.world.step(this.events, this.hooks)
      this.events.clear()
      this.noLaunch(list, rising)
    }
    for (const b of list) this.readBack(b, dt, time, before.get(b))
    this.keepBudget(list)
  }

  /**
   * Contacts never send a piece up: what a step gave it upward beyond the speed it had (or `MOST_UP_SPEED`) is taken back. A blow (`impulse`) is given outside the step and
   * kept; a round piece keeps its bounce.
   */
  private noLaunch(list: readonly PieceBody[], rising: Map<PieceBody, number>): void {
    for (const b of list) {
      const was = rising.get(b)
      if (was === undefined || b.round) continue
      const rb = this.links.get(b)?.rb
      if (!rb || rb.isSleeping()) continue
      const v = rb.linvel()
      const most = Math.max(was, MOST_UP_SPEED)
      if (v.y > most) rb.setLinvel({ x: v.x, y: most, z: v.z }, false)
      rising.set(b, Math.min(v.y, most))
    }
  }

  /** Only the colliders of the pieces in a pair kept apart ask the hook (`hooks`): a call back per pair for every piece would cost the step. */
  private filterApart(list: readonly PieceBody[], apart: ReadonlySet<string>): void {
    this.apart = apart
    const involved = new Set<string>()
    for (const key of apart) for (const id of key.split('\u0000')) involved.add(id)
    for (const b of list) {
      const link = this.links.get(b)
      if (!link) continue
      const hooks = involved.has(b.objectId) ? RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS : RAPIER.ActiveHooks.NONE
      for (const c of link.colliders) if (c.activeHooks() !== hooks) c.setActiveHooks(hooks)
    }
  }

  /** Makes the body of a piece, or brings it up to date with what changed on the piece since the last step. */
  private sync(b: PieceBody, dt: number): void {
    const shape = [b.halfExtents, b.partBoxes, b.round, b.mass, b.localCenter[0], b.localCenter[1], b.localCenter[2], b.friction, b.restitution]
    let link = this.links.get(b)
    if (!link) {
      const rb = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setAngularDamping(0.15).setCcdEnabled(true))
      link = { rb, colliders: [], shape: [], pos: [NaN, NaN, NaN], quat: [NaN, NaN, NaN, NaN], vel: [NaN, NaN, NaN], ang: [NaN, NaN, NaN], held: false }
      this.links.set(b, link)
    }
    if (shape.some((s, i) => s !== link.shape[i])) this.shape(b, link, shape)
    const rb = link.rb
    if (b.held !== link.held) {
      link.held = b.held
      rb.setBodyType(b.held ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true)
    }
    const c = this.centre(b)
    const q = b.root.quaternion
    if (b.held) {
      rb.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z })
      rb.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      return
    }
    const moved = c.x !== link.pos[0] || c.y !== link.pos[1] || c.z !== link.pos[2] || q.x !== link.quat[0] || q.y !== link.quat[1] || q.z !== link.quat[2] || q.w !== link.quat[3]
    if (moved) {
      rb.setTranslation({ x: c.x, y: c.y, z: c.z }, !b.sleeping)
      rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, !b.sleeping)
    }
    const v = b.velocity
    const w = b.angularVelocity
    if (b.tipping && b.onGround && !b.sleeping) this.tip(b, dt)
    if (v[0] !== link.vel[0] || v[1] !== link.vel[1] || v[2] !== link.vel[2]) rb.setLinvel({ x: v[0], y: v[1], z: v[2] }, !b.sleeping)
    if (w[0] !== link.ang[0] || w[1] !== link.ang[1] || w[2] !== link.ang[2]) rb.setAngvel({ x: w[0], y: w[1], z: w[2] }, !b.sleeping)
    if (b.sleeping && !rb.isSleeping()) rb.sleep()
    else if (!b.sleeping && rb.isSleeping()) {
      // woken from outside (its support looked at again, a blow): the ground under it is read again, it may have been dug while it slept
      rb.wakeUp()
      this.groundChanged(c.x, c.z, Math.hypot(...b.halfExtents))
    }
  }

  /** Falling over (`PieceSystem.tip`): the spin it is given on the ground, until it lies or its time is up. */
  private tip(b: PieceBody, dt: number): void {
    const tipping = b.tipping
    if (!tipping) return
    tipping.seconds -= dt
    const e = new Float64Array(9)
    const q = b.root.quaternion
    // the rotation's y row: how tall the box stands as it is turned
    e[1] = 2 * (q.x * q.y + q.w * q.z)
    e[4] = 1 - 2 * (q.x * q.x + q.z * q.z)
    e[7] = 2 * (q.y * q.z - q.w * q.x)
    const [hx, hy, hz] = b.halfExtents
    const upHalf = Math.abs(e[1]) * hx + Math.abs(e[4]) * hy + Math.abs(e[7]) * hz
    if (upHalf < TIP_LYING || tipping.seconds <= 0) {
      b.tipping = null
      return
    }
    b.angularVelocity[0] += tipping.x * TIP_ACCELERATION * dt
    b.angularVelocity[2] += tipping.z * TIP_ACCELERATION * dt
  }

  /** The colliders of a piece, from the centre of mass: its parts' boxes, else its box, or its round shape; its mass and the inertia of its box. */
  private shape(b: PieceBody, link: Link, shape: readonly unknown[]): void {
    for (const c of link.colliders) {
      this.owner.delete(c.handle)
      this.world.removeCollider(c, false)
    }
    link.colliders = []
    link.shape = shape
    const friction = Math.sqrt(b.friction?.static ?? MU_STATIC)
    const restitution = b.round ? Math.sqrt(b.restitution ?? SLAM_BOUNCE) : 0
    const descs: RAPIER.ColliderDesc[] = []
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') descs.push(RAPIER.ColliderDesc.ball(round.radius))
      else {
        const along = RAPIER.ColliderDesc.cylinder(b.halfExtents[round.axis], round.radius)
        // a cylinder stands along its own y: turned onto x or z
        if (round.axis === 0) along.setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        else if (round.axis === 2) along.setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        descs.push(along)
      }
    } else if (b.partBoxes) {
      for (const part of b.partBoxes) descs.push(RAPIER.ColliderDesc.cuboid(...part.half).setTranslation(...part.center))
    } else descs.push(RAPIER.ColliderDesc.cuboid(...b.halfExtents))
    for (const desc of descs) {
      desc.setDensity(0).setFriction(friction).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRestitution(restitution).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      const collider = this.world.createCollider(desc, link.rb)
      this.owner.set(collider.handle, b.objectId)
      link.colliders.push(collider)
    }
    const [hx, hy, hz] = b.halfExtents
    const m = b.mass
    const inertia = { x: (m * (hy * hy + hz * hz)) / 3, y: (m * (hx * hx + hz * hz)) / 3, z: (m * (hx * hx + hy * hy)) / 3 }
    if (round) {
      const about = round.inertia * m * round.radius * round.radius
      if (round.kind === 'sphere') inertia.x = inertia.y = inertia.z = about
      else if (round.axis === 0) inertia.x = about
      else if (round.axis === 1) inertia.y = about
      else inertia.z = about
    }
    link.rb.setAdditionalMassProperties(m, { x: 0, y: 0, z: 0 }, inertia, { x: 0, y: 0, z: 0, w: 1 }, true)
  }

  private centre(b: PieceBody): THREE_NS.Vector3 {
    return this.v.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  /** Lays the tiles of ground under and around what is awake, and samples again those whose region changed. */
  private layGround(list: readonly PieceBody[]): void {
    for (const b of list) {
      if (b.sleeping) continue
      const c = this.centre(b)
      const r = Math.hypot(...b.halfExtents) + TILE_MARGIN
      for (let ix = Math.floor((c.x - r) / TILE); ix <= Math.floor((c.x + r) / TILE); ix++) {
        for (let iz = Math.floor((c.z - r) / TILE); iz <= Math.floor((c.z + r) / TILE); iz++) {
          const key = `${ix},${iz}`
          const tile = this.tiles.get(key)
          if (!tile) this.tiles.set(key, this.makeTile(ix, iz, null))
          else if (tile.dirty) this.tiles.set(key, this.makeTile(ix, iz, tile))
        }
      }
    }
  }

  private makeTile(ix: number, iz: number, old: Tile | null): Tile {
    const n = CELLS + 1
    const heights = new Float32Array(n * n)
    let low = Infinity
    let high = -Infinity
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        // column j runs along x, row i along z (column-major)
        const h = this.o.groundAt(ix * TILE + (j * TILE) / CELLS, iz * TILE + (i * TILE) / CELLS)
        heights[i + j * n] = h
        low = Math.min(low, h)
        high = Math.max(high, h)
      }
    }
    if (old) {
      old.dirty = false
      if (old.heights.every((h, k) => h === heights[k])) return old
      this.world.removeCollider(old.collider, false)
    }
    const cx = (ix + 0.5) * TILE
    const cz = (iz + 0.5) * TILE
    // level ground is a slab, cheaper than a heightfield and solid below
    const desc =
      high - low < 1e-6
        ? RAPIER.ColliderDesc.cuboid(TILE / 2, 0.5, TILE / 2).setTranslation(cx, high - 0.5, cz)
        : RAPIER.ColliderDesc.heightfield(CELLS, CELLS, heights, { x: TILE, y: 1, z: TILE }, RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES).setTranslation(cx, 0, cz)
    desc.setFriction(Math.sqrt(MU_STATIC)).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply).setRestitution(0)
    return { collider: this.world.createCollider(desc), heights, dirty: false }
  }

  /** The host's fixed boxes as fixed cuboids, made again for an object whose boxes were measured again. */
  private layStatics(): void {
    const now = this.o.staticBoxes?.()
    if (!now) return
    for (const [id, s] of this.statics) {
      if (now.get(id) === s.boxes) continue
      for (const c of s.colliders) this.world.removeCollider(c, false)
      this.statics.delete(id)
    }
    for (const [id, boxes] of now) {
      if (this.statics.has(id)) continue
      const colliders: Collider[] = []
      for (let i = 6; i + 5 < boxes.length; i += 6) {
        const half = [(boxes[i + 3] - boxes[i]) / 2, (boxes[i + 4] - boxes[i + 1]) / 2, (boxes[i + 5] - boxes[i + 2]) / 2]
        if (half.some((h) => !(h > 0))) continue
        const desc = RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(boxes[i] + half[0], boxes[i + 1] + half[1], boxes[i + 2] + half[2])
        desc.setFriction(Math.sqrt(MU_STATIC)).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
        colliders.push(this.world.createCollider(desc))
      }
      this.statics.set(id, { boxes, colliders })
    }
  }

  /** Writes the body back to the piece, then the kit's rules: the sweep against walls, hard landings, rolling resistance, sleep. */
  private readBack(b: PieceBody, dt: number, time: number, before: { c: Vec3; vy: number } | undefined): void {
    const link = this.links.get(b)
    if (!link || b.held) return
    const rb = link.rb
    const t = rb.translation()
    const r = rb.rotation()
    const lv = rb.linvel()
    const av = rb.angvel()
    const pos: Vec3 = [t.x, t.y, t.z]
    const v = b.velocity
    const w = b.angularVelocity
    v[0] = lv.x
    v[1] = lv.y
    v[2] = lv.z
    w[0] = av.x
    w[1] = av.y
    w[2] = av.z
    b.sleeping = rb.isSleeping()
    if (!b.sleeping) b.onGround = this.touches(link)
    if (before && !b.sleeping) {
      if (this.o.sweep) this.sweepOn(b, before.c, pos, time)
      const impact = -before.vy
      if (b.onGround && impact > HARD_LANDING && v[1] > before.vy + impact * 0.5 && time - b.lastHit > 0.15) {
        b.lastHit = time
        this.o.onHardLanding(b, [pos[0], pos[1] - Math.min(...b.halfExtents), pos[2]], impact)
      }
      if (b.round && b.onGround) this.rollingResistance(b, dt)
    }
    this.q.set(r.x, r.y, r.z, r.w)
    b.root.quaternion.copy(this.q)
    const off = this.v.copy(b.centerV).applyQuaternion(this.q)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    if (!b.sleeping && !b.round && b.onGround) this.topple(b, link, dt, pos)
    // Rapier puts whole islands to sleep (forcing one body of an island asleep left it sinking under the sheet that landed on it): `still` only feeds the budget
    if (!b.sleeping) {
      const still = b.onGround && !b.tipping && Math.hypot(v[0], v[1], v[2]) < STILL_SPEED && Math.hypot(w[0], w[1], w[2]) < STILL_SPIN
      b.still = still ? b.still + dt : 0
    }
    // what is written back is what the next step compares against: a change from outside differs from it
    const c = this.centre(b)
    link.pos[0] = c.x
    link.pos[1] = c.y
    link.pos[2] = c.z
    link.quat[0] = b.root.quaternion.x
    link.quat[1] = b.root.quaternion.y
    link.quat[2] = b.root.quaternion.z
    link.quat[3] = b.root.quaternion.w
    for (let i = 0; i < 3; i++) {
      link.vel[i] = v[i]
      link.ang[i] = w[i]
    }
    if (pos[0] !== t.x || pos[1] !== t.y || pos[2] !== t.z) {
      rb.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true)
      rb.setLinvel({ x: v[0], y: v[1], z: v[2] }, true)
      rb.setAngvel({ x: w[0], y: w[1], z: w[2] }, true)
    }
  }

  /**
   * The kit's balancing rule over Rapier's contacts: a piece whose support (the points it touches by) is narrower than `NARROW` of the height of its centre of mass, or
   * does not have the centre of mass over it, is not at rest there: it gets a gentle push toward the side it leans to, and stays awake.
   */
  private topple(b: PieceBody, link: Link, dt: number, c: Vec3): void {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, low = 0
    let any = false
    for (const collider of link.colliders) {
      this.world.contactPairsWith(collider, (other) => {
        this.world.contactPair(collider, other, (manifold) => {
          for (let i = 0; i < manifold.numSolverContacts(); i++) {
            const p = manifold.solverContactPoint(i)
            if (!p) continue
            any = true
            const rx = p.x - c[0], ry = p.y - c[1], rz = p.z - c[2]
            x0 = Math.min(x0, rx); x1 = Math.max(x1, rx)
            z0 = Math.min(z0, rz); z1 = Math.max(z1, rz)
            low = Math.min(low, ry)
          }
        })
      })
    }
    b.balancing = false
    if (!any) return
    const height = -low
    const wx = x1 - x0
    const wz = z1 - z0
    if (!(Math.min(wx, wz) < NARROW * height || x0 > 0 || x1 < 0 || z0 > 0 || z1 < 0)) return
    b.balancing = true
    const dirX = x0 + x1 > 0 ? -1 : 1
    const dirZ = z0 + z1 > 0 ? -1 : 1
    const k = TOPPLE * Math.min(height, 1) * dt
    const w = b.angularVelocity
    if (wx <= wz) w[2] -= dirX * k
    else w[0] += dirZ * k
    link.rb.setAngvel({ x: w[0], y: w[1], z: w[2] }, true)
  }

  private sleep(b: PieceBody, link: Link): void {
    b.sleeping = true
    b.velocity[0] = b.velocity[1] = b.velocity[2] = 0
    b.angularVelocity[0] = b.angularVelocity[1] = b.angularVelocity[2] = 0
    link.rb.setLinvel({ x: 0, y: 0, z: 0 }, false)
    link.rb.setAngvel({ x: 0, y: 0, z: 0 }, false)
    link.rb.sleep()
  }

  /** Whether any collider of the piece touches anything (the ground, a fixed box, another piece). */
  private touches(link: Link): boolean {
    let touching = false
    for (const c of link.colliders) {
      this.world.contactPairsWith(c, (other) => {
        if (touching) return
        this.world.contactPair(c, other, (manifold) => {
          if (manifold.numContacts() > 0) touching = true
        })
      })
      if (touching) return true
    }
    return false
  }

  /** Stops a piece that ran into something on its way (`sweep`): back to where it met it, the speed into it reflected, as the kit's solver does. */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3, time: number): void {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return
    const k = Math.min(1, hit.distance / travel)
    const bounce = Math.sqrt((b.restitution ?? SLAM_BOUNCE) * (hit.restitution ?? SLAM_BOUNCE))
    for (let i = 0; i < 3; i++) {
      pos[i] = start[i] + (pos[i] - start[i]) * k
      v[i] += (1 + bounce) * into * n[i]
    }
    for (let i = 0; i < 3; i++) b.angularVelocity[i] *= 0.5
    if (into >= SLAM_MIN_SPEED && time - b.lastHit > 0.15) {
      b.lastHit = time
      this.o.onSlam?.(b, hit, into)
    }
  }

  /** A round piece on the ground loses spin by its rolling resistance (C_rr g / (k r) per second). */
  private rollingResistance(b: PieceBody, dt: number): void {
    const round = b.round
    if (!round) return
    const w = b.angularVelocity
    const spin = Math.hypot(w[0], w[1], w[2])
    if (spin < 1e-9) return
    const rolling = (b.friction as PieceFriction | undefined)?.rolling ?? ROLLING_RESISTANCE
    const slow = Math.max(0, spin - (rolling * this.o.gravity * dt) / (round.inertia * round.radius)) / spin
    for (let i = 0; i < 3; i++) w[i] *= slow
  }

  /** Over `maxAwake`, the oldest pieces at rest on something sleep where they lie. */
  private keepBudget(list: readonly PieceBody[]): void {
    const most = this.o.maxAwake
    if (most === undefined || !Number.isFinite(most)) return
    let awake = list.filter((b) => !b.sleeping && !b.held).length
    for (const b of list) {
      if (awake <= most) return
      const link = this.links.get(b)
      if (!link || b.sleeping || b.held || !b.onGround || b.tipping) continue
      if (Math.hypot(...b.velocity) >= STILL_SPEED || Math.hypot(...b.angularVelocity) >= STILL_SPIN) continue
      this.sleep(b, link)
      awake--
    }
  }
}
