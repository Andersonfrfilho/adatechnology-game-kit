import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import type { ColliderDesc, PhysicsWorld, Quat } from '@adatechnology/game-physics'
import type { PieceBody } from './internal'
import type { PieceSweepHit } from './pieces'
import { buildGroundTile } from './step-ground'

export interface EnginePieceOptions {
  readonly physics: PhysicsWorld
  readonly groundAt: (x: number, z: number) => number
  readonly gravity: number
  /** Rotated boxes of what does not move, per object, 10 numbers each (centre x, y, z, half x, y, z, quaternion x, y, z, w): what is drawn, not its axis box. */
  readonly staticBoxes?: () => ReadonlyMap<string, readonly number[]>
  readonly sweep?: (piece: PieceBody, from: Vec3, to: Vec3) => PieceSweepHit | null
  readonly onSlam?: (piece: PieceBody, hit: PieceSweepHit, speed: number) => void
  readonly onHardLanding: (piece: PieceBody, point: Vec3, speed: number) => void
  /** Side (m) of a ground tile and its cells across (default 2 m, 80: 2.5 cm cells). */
  readonly groundTile?: number
  readonly groundCells?: number
}

const MU_STATIC = 0.7
const MU_DYNAMIC = 0.6
/** The kit's Coulomb rule on an engine with one coefficient: a piece sliding faster than this (m/s) drags with its dynamic friction, slower it holds with the static one. */
const SLIP_SPEED = 0.02
const ROLLING_RESISTANCE = 0.015
const HARD_LANDING = 3
const SLAM_MIN_SPEED = 2
const SLAM_BOUNCE = 0.2
const SLAM_FLOOR_NORMAL = 0.7
const TIP_ACCELERATION = 30
const TIP_LYING = 0.25
const TILE_MARGIN = 0.5

interface Link {
  body: number
  key: string
  held: boolean
  /** The root position written back last. */
  readonly pos: number[]
  readonly quat: number[]
  readonly vel: number[]
  readonly ang: number[]
  mu: number
}

interface Tile {
  body: number
  samples: Float64Array
  dirty: boolean
}

/**
 * Steps the loose pieces through the kit's physics contract (`@adatechnology/game-physics`): each piece a dynamic body at its centre of mass with its parts' boxes as a
 * compound, the ground as step-keeping triangle tiles of `groundAt`, fixed things as the rotated boxes of what is drawn. The engine owns contacts, islands and sleep; the
 * kit keeps its rules on top: static/dynamic friction per piece, walls by `sweep`, hard landings, rolling resistance, tipping, deep overlaps put apart along the ground.
 */
export class EnginePieces {
  private readonly links = new Map<PieceBody, Link>()
  private readonly tiles = new Map<string, Tile>()
  private readonly statics = new Map<string, { boxes: readonly number[]; body: number }>()
  private readonly pose = new Float64Array(7)
  private readonly vel = new Float64Array(6)
  private readonly v: THREE_NS.Vector3
  private readonly q: THREE_NS.Quaternion
  private readonly tile: number
  private readonly cells: number
  private apartNow = new Map<string, [number, number]>()
  /** Seconds spent laying ground in the last update (for the measurements). */
  groundMs = 0

  constructor(
    THREE: typeof THREE_NS,
    private readonly o: EnginePieceOptions,
  ) {
    this.v = new THREE.Vector3()
    this.q = new THREE.Quaternion()
    this.tile = o.groundTile ?? 2
    this.cells = o.groundCells ?? 80
  }

  private get w(): PhysicsWorld {
    return this.o.physics
  }

  remove(b: PieceBody): void {
    const link = this.links.get(b)
    if (!link) return
    this.w.removeBody(link.body)
    this.links.delete(b)
  }

  clear(): void {
    for (const b of [...this.links.keys()]) this.remove(b)
    for (const t of this.tiles.values()) this.w.removeBody(t.body)
    this.tiles.clear()
    for (const s of this.statics.values()) this.w.removeBody(s.body)
    this.statics.clear()
    this.apartNow.clear()
  }

  /** The ground under the disc changed: its tiles are sampled again before the next step. */
  groundChanged(x: number, z: number, radius: number): void {
    const t = this.tile
    for (const [key, tile] of this.tiles) {
      const [ix, iz] = key.split(',').map(Number)
      const nx = Math.max(ix * t, Math.min(x, (ix + 1) * t))
      const nz = Math.max(iz * t, Math.min(z, (iz + 1) * t))
      if (Math.hypot(nx - x, nz - z) <= radius) tile.dirty = true
    }
  }

  /** A step of `dt`. `apart`: pairs born inside each other that the kit puts apart along the ground; the engine lets them pass until they are apart. */
  update(list: readonly PieceBody[], dt: number, time: number, apart: ReadonlyArray<readonly [PieceBody, PieceBody]>): void {
    if (dt <= 0) return
    for (const b of list) this.sync(b, dt)
    for (const [b] of this.links) if (!list.includes(b)) this.remove(b)
    const t0 = performance.now()
    this.layGround(list, dt)
    this.layStatics()
    this.groundMs = performance.now() - t0
    this.keepApart(apart)
    const before = new Map<PieceBody, { c: Vec3; vy: number }>()
    for (const b of list) {
      if (b.held || b.sleeping) continue
      const c = this.centre(b)
      before.set(b, { c: [c.x, c.y, c.z], vy: b.velocity[1] })
    }
    this.w.step(dt)
    for (const b of list) this.readBack(b, dt, time, before.get(b))
  }

  private keepApart(apart: ReadonlyArray<readonly [PieceBody, PieceBody]>): void {
    const next = new Map<string, [number, number]>()
    for (const [a, b] of apart) {
      const la = this.links.get(a)
      const lb = this.links.get(b)
      if (!la || !lb) continue
      const key = la.body < lb.body ? `${la.body}:${lb.body}` : `${lb.body}:${la.body}`
      next.set(key, [la.body, lb.body])
      if (!this.apartNow.has(key)) this.w.setPairContacts(la.body, lb.body, false)
    }
    for (const [key, [a, b]] of this.apartNow) if (!next.has(key)) this.w.setPairContacts(a, b, true)
    this.apartNow = next
  }

  private colliders(b: PieceBody): ColliderDesc[] {
    const surface = { friction: { static: b.friction?.static ?? MU_STATIC, dynamic: b.friction?.dynamic ?? MU_DYNAMIC }, restitution: b.round ? (b.restitution ?? SLAM_BOUNCE) : 0 }
    const round = b.round
    if (round) {
      if (round.kind === 'sphere') return [{ shape: { kind: 'sphere', radius: round.radius }, surface, tag: 0 }]
      // a cylinder stands along its own y: turned onto x or z
      const rotation: Quat = round.axis === 0 ? [0, 0, Math.SQRT1_2, Math.SQRT1_2] : round.axis === 2 ? [Math.SQRT1_2, 0, 0, Math.SQRT1_2] : [0, 0, 0, 1]
      return [{ shape: { kind: 'cylinder', halfHeight: b.halfExtents[round.axis], radius: round.radius }, rotation, surface, tag: 0 }]
    }
    if (b.partBoxes) return b.partBoxes.map((p) => ({ shape: { kind: 'box', half: [...p.half] as Vec3 }, offset: [...p.center] as Vec3, surface, tag: 0 }))
    return [{ shape: { kind: 'box', half: [...b.halfExtents] as Vec3 }, surface, tag: 0 }]
  }

  private inertia(b: PieceBody): Vec3 {
    const [hx, hy, hz] = b.halfExtents
    const m = b.mass
    const i: Vec3 = [(m * (hy * hy + hz * hz)) / 3, (m * (hx * hx + hz * hz)) / 3, (m * (hx * hx + hy * hy)) / 3]
    const round = b.round
    if (round) {
      const about = round.inertia * m * round.radius * round.radius
      if (round.kind === 'sphere') i[0] = i[1] = i[2] = about
      else i[round.axis] = about
    }
    return i
  }

  /** Makes the body of a piece, or brings it up to date with what changed on the piece since the last step (moved, pushed, picked up, woken). */
  private sync(b: PieceBody, dt: number): void {
    // by value: the renderer measures a piece's parts again (new arrays) without changing them
    const key = JSON.stringify([b.halfExtents, b.partBoxes, b.round, b.mass, b.localCenter, b.friction, b.restitution, b.held])
    let link = this.links.get(b)
    const c = this.centre(b)
    const q = b.root.quaternion
    if (!link || key !== link.key) {
      if (link) this.w.removeBody(link.body)
      // the engine's ground is one-sided: a piece born deeper in it than a contact would be pushed down through it, so it starts on top
      else if (!b.held) this.liftOutOfGround(b, c, q)
      const body = this.w.createBody({
        kind: b.held ? 'kinematic' : 'dynamic',
        position: [c.x, c.y, c.z],
        rotation: [q.x, q.y, q.z, q.w],
        velocity: [...b.velocity] as Vec3,
        spin: [...b.angularVelocity] as Vec3,
        mass: b.mass,
        inertia: this.inertia(b),
        ccd: true,
        angularDamping: 0.15,
        colliders: this.colliders(b),
      })
      const r = b.root.position
      link = { body, key, held: b.held, pos: [r.x, r.y, r.z], quat: [q.x, q.y, q.z, q.w], vel: [...b.velocity], ang: [...b.angularVelocity], mu: b.friction?.static ?? MU_STATIC }
      this.links.set(b, link)
      if (b.sleeping) this.w.sleep(body)
      return
    }
    if (b.held) {
      this.w.moveKinematic(link.body, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w])
      return
    }
    // the root as it was written back (not the centre worked out from it again, which differs by rounding and would wake the body every frame)
    const r = b.root.position
    const moved = r.x !== link.pos[0] || r.y !== link.pos[1] || r.z !== link.pos[2] || q.x !== link.quat[0] || q.y !== link.quat[1] || q.z !== link.quat[2] || q.w !== link.quat[3]
    if (moved) this.w.setPose(link.body, [c.x, c.y, c.z], [q.x, q.y, q.z, q.w])
    if (b.tipping && b.onGround && !b.sleeping) this.tip(b, dt)
    const v = b.velocity
    const w = b.angularVelocity
    const pushed = v.some((x, i) => x !== link?.vel[i]) || w.some((x, i) => x !== link?.ang[i])
    if (pushed) this.w.setVelocity(link.body, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    // woken from outside (`wakeRegion`, a blow): the engine wakes it; the kit never forces a body of an island asleep
    if (!b.sleeping && this.w.isSleeping(link.body)) this.w.wake(link.body)
  }

  private liftOutOfGround(b: PieceBody, c: THREE_NS.Vector3, q: THREE_NS.Quaternion): void {
    const boxes = b.partBoxes ?? [{ center: [0, 0, 0] as Vec3, half: b.halfExtents }]
    let deficit = 0
    const p = this.v.clone()
    for (const box of boxes) {
      for (let k = 0; k < 8; k++) {
        p.set(box.center[0] + (k & 1 ? 1 : -1) * box.half[0], box.center[1] + (k & 2 ? 1 : -1) * box.half[1], box.center[2] + (k & 4 ? 1 : -1) * box.half[2]).applyQuaternion(q).add(c)
        deficit = Math.max(deficit, this.o.groundAt(p.x, p.z) - p.y)
      }
    }
    if (deficit <= 0.01) return
    b.root.position.y += deficit
    b.root.updateMatrixWorld(true)
    c.y += deficit
  }

  private tip(b: PieceBody, dt: number): void {
    const tipping = b.tipping
    if (!tipping) return
    tipping.seconds -= dt
    const q = b.root.quaternion
    const e1 = 2 * (q.x * q.y + q.w * q.z)
    const e4 = 1 - 2 * (q.x * q.x + q.z * q.z)
    const e7 = 2 * (q.y * q.z - q.w * q.x)
    const [hx, hy, hz] = b.halfExtents
    const upHalf = Math.abs(e1) * hx + Math.abs(e4) * hy + Math.abs(e7) * hz
    if (upHalf < TIP_LYING || tipping.seconds <= 0) {
      b.tipping = null
      return
    }
    b.angularVelocity[0] += tipping.x * TIP_ACCELERATION * dt
    b.angularVelocity[2] += tipping.z * TIP_ACCELERATION * dt
  }

  private centre(b: PieceBody): THREE_NS.Vector3 {
    return this.v.copy(b.centerV).applyQuaternion(b.root.quaternion).add(b.root.position)
  }

  /** Lays the tiles of ground under and around what is awake (and where it can reach this update), and samples again those whose region changed. */
  private layGround(list: readonly PieceBody[], dt: number): void {
    const t = this.tile
    for (const b of list) {
      const c = this.centre(b)
      const reach = Math.hypot(...b.halfExtents) + TILE_MARGIN + Math.hypot(...b.velocity) * dt
      for (let ix = Math.floor((c.x - reach) / t); ix <= Math.floor((c.x + reach) / t); ix++) {
        for (let iz = Math.floor((c.z - reach) / t); iz <= Math.floor((c.z + reach) / t); iz++) {
          const key = `${ix},${iz}`
          const tile = this.tiles.get(key)
          if (!tile) this.tiles.set(key, this.makeTile(ix, iz, null))
          else if (tile.dirty) this.tiles.set(key, this.makeTile(ix, iz, tile))
        }
      }
    }
  }

  private makeTile(ix: number, iz: number, old: Tile | null): Tile {
    const t = this.tile
    const mesh = buildGroundTile(this.o.groundAt, ix * t, iz * t, t, this.cells)
    if (old) {
      old.dirty = false
      if (old.samples.length === mesh.samples.length && old.samples.every((h, k) => h === mesh.samples[k])) return old
      this.w.removeBody(old.body)
      // what lay on the old ground looks at the new one
      for (const [b, link] of this.links) {
        const p = b.root.position
        if (p.x >= ix * t - 1 && p.x <= (ix + 1) * t + 1 && p.z >= iz * t - 1 && p.z <= (iz + 1) * t + 1 && this.w.isSleeping(link.body)) this.w.wake(link.body)
      }
    }
    const surface = { friction: { static: MU_STATIC, dynamic: MU_STATIC }, restitution: 0 }
    const colliders: ColliderDesc[] = []
    if (mesh.level !== null) colliders.push({ shape: { kind: 'box', half: [t / 2, 0.5, t / 2] }, offset: [(ix + 0.5) * t, mesh.level - 0.5, (iz + 0.5) * t], surface, tag: -2 })
    else {
      colliders.push({ shape: { kind: 'heightfield', cells: this.cells, size: t, heights: mesh.heights }, offset: [(ix + 0.5) * t, 0, (iz + 0.5) * t], surface, tag: -2 })
      const b = mesh.boxes
      for (let k = 0; k + 5 < b.length; k += 6) colliders.push({ shape: { kind: 'box', half: [b[k + 3], b[k + 4], b[k + 5]] }, offset: [b[k], b[k + 1], b[k + 2]], surface, tag: -2 })
    }
    return { body: this.w.createBody({ kind: 'fixed', position: [0, 0, 0], colliders }), samples: mesh.samples, dirty: false }
  }

  /** The host's rotated boxes of fixed things, made again for an object whose boxes were measured again. */
  private layStatics(): void {
    const now = this.o.staticBoxes?.()
    if (!now) return
    for (const [id, s] of this.statics) {
      if (now.get(id) === s.boxes) continue
      this.w.removeBody(s.body)
      this.statics.delete(id)
    }
    for (const [id, boxes] of now) {
      if (this.statics.has(id) || boxes.length < 10) continue
      const colliders: ColliderDesc[] = []
      for (let i = 0; i + 9 < boxes.length; i += 10) {
        const half: Vec3 = [boxes[i + 3], boxes[i + 4], boxes[i + 5]]
        if (half.some((h) => !(h > 0))) continue
        colliders.push({ shape: { kind: 'box', half }, offset: [boxes[i], boxes[i + 1], boxes[i + 2]], rotation: [boxes[i + 6], boxes[i + 7], boxes[i + 8], boxes[i + 9]], tag: -3 })
      }
      if (colliders.length > 0) this.statics.set(id, { boxes, body: this.w.createBody({ kind: 'fixed', position: [0, 0, 0], colliders }) })
    }
  }

  /** Writes the body back to the piece, then the kit's rules: the sweep against walls, hard landings, rolling resistance, static or dynamic friction for the next step. */
  private readBack(b: PieceBody, dt: number, time: number, before: { c: Vec3; vy: number } | undefined): void {
    const link = this.links.get(b)
    if (!link || b.held) return
    this.w.readPose(link.body, this.pose)
    this.w.readVelocity(link.body, this.vel)
    const p = this.pose
    const pos: Vec3 = [p[0], p[1], p[2]]
    const v = b.velocity
    const w = b.angularVelocity
    for (let i = 0; i < 3; i++) {
      v[i] = this.vel[i]
      w[i] = this.vel[i + 3]
    }
    b.sleeping = this.w.isSleeping(link.body)
    if (!b.sleeping) b.onGround = this.w.touching(link.body)
    let corrected = false
    if (before && !b.sleeping) {
      if (this.o.sweep) corrected = this.sweepOn(b, before.c, pos, time)
      const impact = -before.vy
      if (b.onGround && impact > HARD_LANDING && v[1] > before.vy + impact * 0.5 && time - b.lastHit > 0.15) {
        b.lastHit = time
        this.o.onHardLanding(b, [pos[0], pos[1] - Math.min(...b.halfExtents), pos[2]], impact)
      }
      if (b.round && b.onGround) corrected = this.rollingResistance(b, dt) || corrected
    }
    this.q.set(p[3], p[4], p[5], p[6])
    b.root.quaternion.copy(this.q)
    const off = this.v.copy(b.centerV).applyQuaternion(this.q)
    b.root.position.set(pos[0] - off.x, pos[1] - off.y, pos[2] - off.z)
    b.root.updateMatrixWorld(true)
    // Coulomb with two coefficients on a one-coefficient engine: per piece, by how fast it slides
    if (!b.sleeping && !b.round) {
      const sliding = Math.hypot(v[0], v[2]) > SLIP_SPEED
      const mu = sliding ? (b.friction?.dynamic ?? MU_DYNAMIC) : (b.friction?.static ?? MU_STATIC)
      if (mu !== link.mu) {
        link.mu = mu
        this.w.setFriction(link.body, mu)
      }
    }
    link.pos[0] = b.root.position.x
    link.pos[1] = b.root.position.y
    link.pos[2] = b.root.position.z
    link.quat[0] = this.q.x
    link.quat[1] = this.q.y
    link.quat[2] = this.q.z
    link.quat[3] = this.q.w
    for (let i = 0; i < 3; i++) {
      link.vel[i] = v[i]
      link.ang[i] = w[i]
    }
    if (corrected) {
      this.w.setPose(link.body, pos, [this.q.x, this.q.y, this.q.z, this.q.w])
      this.w.setVelocity(link.body, [v[0], v[1], v[2]], [w[0], w[1], w[2]])
    }
  }

  /** A piece that ran into a wall on its way (`sweep`: walls and what the static boxes leave out): back to where it met it, the speed into it reflected. */
  private sweepOn(b: PieceBody, start: Vec3, pos: Vec3, time: number): boolean {
    const travel = Math.hypot(pos[0] - start[0], pos[1] - start[1], pos[2] - start[2])
    if (travel < 1e-3) return false
    const hit = this.o.sweep?.(b, start, pos)
    if (!hit || hit.normal[1] > SLAM_FLOOR_NORMAL) return false
    const v = b.velocity
    const n = hit.normal
    const into = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
    if (into <= 0) return false
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
    return true
  }

  /** A round piece on the ground loses spin by its rolling resistance (C_rr g / (k r) per second): the engine has no rolling friction. */
  private rollingResistance(b: PieceBody, dt: number): boolean {
    const round = b.round
    if (!round) return false
    const w = b.angularVelocity
    const spin = Math.hypot(w[0], w[1], w[2])
    // slower than this it is the engine's to put to sleep: setting a speed would wake it every frame
    if (spin < 0.05) return false
    const rolling = b.friction?.rolling ?? ROLLING_RESISTANCE
    const slow = Math.max(0, spin - (rolling * this.o.gravity * dt) / (round.inertia * round.radius)) / spin
    for (let i = 0; i < 3; i++) w[i] *= slow
    return true
  }
}
