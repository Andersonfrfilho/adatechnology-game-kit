import type * as RapierModule from '@dimforge/rapier3d-deterministic-compat'
import type {
  BodyDesc,
  ColliderDesc,
  ContactForce,
  JointDesc,
  PhysicsEngine,
  PhysicsWorld,
  QueryFilter,
  Quat,
  RayHit,
  Vec3,
  WorldOptions,
} from '@adatechnology/game-physics'

/** One of Rapier's builds (deterministic-compat, simd-compat, ...): the adapter takes the module so both can be measured with the same code. */
export type Rapier = typeof RapierModule
type World = RapierModule.World
type RigidBody = RapierModule.RigidBody
type Collider = RapierModule.Collider

/** Rapier's per-axis joint limits live on the raw joint set only (0.21: `UnitImpulseJoint.setLimits` covers hinge and slider, not a ball). */
interface RawJointSet {
  jointSetLimits(handle: number, axis: number, min: number, max: number): void
}
const ANG_X = 3
const ANG_Y = 4
const ANG_Z = 5

const IDENTITY: Quat = [0, 0, 0, 1]
const DEFAULT_SURFACE = { friction: { static: 0.7, dynamic: 0.6 }, restitution: 0 }

export interface RapierEngineOptions {
  /** Loaded module (after `await R.init()`). */
  readonly rapier: Rapier
  readonly name?: string
  readonly deterministic: boolean
  /**
   * Rapier's FIX_INTERNAL_EDGES on triangle meshes (default on: without it boxes catch on inner edges). With it a mesh is one-sided: a body that starts more than about
   * half its size under the surface is pushed down through it, so what is born inside the ground has to be lifted out first (the kit does it when it makes a piece).
   */
  readonly fixTrimeshEdges?: boolean
}

export const createRapierEngine = (o: RapierEngineOptions): PhysicsEngine => ({
  name: o.name ?? 'rapier',
  deterministic: o.deterministic,
  createWorld: (w) => new RapierWorld(o.rapier, w, o.fixTrimeshEdges ?? true),
})

const groups = (layer: number | undefined, meets: number | undefined): number => (((layer ?? 1) & 0xffff) << 16) | ((meets ?? 0xffff) & 0xffff)

export class RapierWorld implements PhysicsWorld {
  readonly engine = 'rapier'
  readonly frictionModel = 'single-coefficient' as const
  world: World
  private readonly tags = new Map<number, number>()
  private readonly events: RapierModule.EventQueue
  private readonly maxStep: number
  private readonly ray: RapierModule.Ray
  private readonly force: { tagA: number; tagB: number; bodyA: number; bodyB: number; force: number; direction: Vec3 } = {
    tagA: 0,
    tagB: 0,
    bodyA: 0,
    bodyB: 0,
    force: 0,
    direction: [0, 0, 0],
  }
  private readonly ball: RapierModule.Ball
  /** Scratch targets: Rapier's getters allocate a new vector unless given one. */
  private readonly sv = { x: 0, y: 0, z: 0 }
  private readonly sq = { x: 0, y: 0, z: 0, w: 1 }
  private sorted: RayHit[] = []

  constructor(
    private readonly R: Rapier,
    o: WorldOptions,
    private readonly fixTrimeshEdges = false,
  ) {
    this.world = new R.World({ x: o.gravity[0], y: o.gravity[1], z: o.gravity[2] })
    if (o.solverIterations !== undefined) this.world.numSolverIterations = o.solverIterations
    if (o.innerIterations !== undefined) this.world.numInternalPgsIterations = o.innerIterations
    this.maxStep = o.maxStep ?? 1 / 60
    this.events = new R.EventQueue(true)
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    this.ball = new R.Ball(0.01)
  }

  createBody(d: BodyDesc): number {
    const R = this.R
    const desc = d.kind === 'dynamic' ? R.RigidBodyDesc.dynamic() : d.kind === 'fixed' ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.kinematicPositionBased()
    const q = d.rotation ?? IDENTITY
    desc.setTranslation(d.position[0], d.position[1], d.position[2]).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
    if (d.velocity) desc.setLinvel(d.velocity[0], d.velocity[1], d.velocity[2])
    if (d.spin) desc.setAngvel({ x: d.spin[0], y: d.spin[1], z: d.spin[2] })
    if (d.ccd) desc.setCcdEnabled(true)
    if (d.canSleep === false) desc.setCanSleep(false)
    if (d.linearDamping !== undefined) desc.setLinearDamping(d.linearDamping)
    if (d.angularDamping !== undefined) desc.setAngularDamping(d.angularDamping)
    if (d.mass !== undefined && d.kind === 'dynamic') {
      const i = d.inertia ?? [d.mass * 0.1, d.mass * 0.1, d.mass * 0.1]
      desc.setAdditionalMassProperties(d.mass, { x: 0, y: 0, z: 0 }, { x: i[0], y: i[1], z: i[2] }, { x: 0, y: 0, z: 0, w: 1 })
    }
    const rb = this.world.createRigidBody(desc)
    for (const c of d.colliders) this.addCollider(rb, c, d.mass !== undefined)
    return rb.handle
  }

  private addCollider(rb: RigidBody, c: ColliderDesc, massGiven: boolean): Collider {
    const R = this.R
    const s = c.shape
    let desc: RapierModule.ColliderDesc | null
    switch (s.kind) {
      case 'box':
        desc = R.ColliderDesc.cuboid(s.half[0], s.half[1], s.half[2])
        break
      case 'sphere':
        desc = R.ColliderDesc.ball(s.radius)
        break
      case 'capsule':
        desc = R.ColliderDesc.capsule(s.halfHeight, s.radius)
        break
      case 'cylinder':
        desc = R.ColliderDesc.cylinder(s.halfHeight, s.radius)
        break
      case 'convex':
        desc = R.ColliderDesc.convexHull(s.points)
        break
      case 'trimesh':
        desc = R.ColliderDesc.trimesh(s.vertices, s.indices, this.fixTrimeshEdges ? R.TriMeshFlags.FIX_INTERNAL_EDGES : (0 as RapierModule.TriMeshFlags))
        break
      case 'heightfield':
        desc = R.ColliderDesc.heightfield(s.cells, s.cells, s.heights, { x: s.size, y: 1, z: s.size }, R.HeightFieldFlags.FIX_INTERNAL_EDGES)
        break
    }
    if (!desc) throw new Error(`game-physics-rapier: shape ${s.kind} could not be built`)
    const surface = c.surface ?? DEFAULT_SURFACE
    const q = c.rotation ?? IDENTITY
    if (c.offset) desc.setTranslation(c.offset[0], c.offset[1], c.offset[2])
    desc.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
    // one coefficient in the solver: the dynamic one, mixed by geometric mean like the kit (sqrt each side, Multiply)
    desc
      .setFriction(Math.sqrt(surface.friction.dynamic))
      .setFrictionCombineRule(R.CoefficientCombineRule.Multiply)
      .setRestitution(Math.sqrt(surface.restitution))
      .setRestitutionCombineRule(R.CoefficientCombineRule.Multiply)
      .setCollisionGroups(groups(c.layer, c.meets))
    if (massGiven) desc.setDensity(0)
    // a sensor reports kinematic and fixed visitors too (Rapier only checks dynamic pairs by default)
    if (c.sensor) desc.setSensor(true).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS).setActiveCollisionTypes(R.ActiveCollisionTypes.ALL)
    if (c.contactForceOver !== undefined) desc.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(c.contactForceOver)
    const collider = this.world.createCollider(desc, rb)
    // Rapier keeps no integer user data on colliders: a side table by handle
    this.tags.set(collider.handle, c.tag)
    return collider
  }

  removeBody(body: number): void {
    const rb = this.world.getRigidBody(body)
    if (!rb) return
    // its joints go with it: forget the pairs it was kept apart in
    for (const key of [...this.apart.keys()]) {
      const [a, b] = key.split(':').map(Number)
      if (a === body || b === body) this.apart.delete(key)
    }
    for (let i = 0; i < rb.numColliders(); i++) this.tags.delete(rb.collider(i).handle)
    this.world.removeRigidBody(rb)
  }

  private rb(body: number): RigidBody {
    return this.world.getRigidBody(body)
  }

  readPose(body: number, out: Float64Array, at = 0): void {
    const rb = this.rb(body)
    const t = rb.translation(this.sv)
    const r = rb.rotation(this.sq)
    out[at] = t.x
    out[at + 1] = t.y
    out[at + 2] = t.z
    out[at + 3] = r.x
    out[at + 4] = r.y
    out[at + 5] = r.z
    out[at + 6] = r.w
  }

  readVelocity(body: number, out: Float64Array, at = 0): void {
    const rb = this.rb(body)
    const v = rb.linvel(this.sv)
    out[at] = v.x
    out[at + 1] = v.y
    out[at + 2] = v.z
    const w = rb.angvel(this.sv)
    out[at + 3] = w.x
    out[at + 4] = w.y
    out[at + 5] = w.z
  }

  setPose(body: number, p: Vec3, q: Quat): void {
    const rb = this.rb(body)
    rb.setTranslation({ x: p[0], y: p[1], z: p[2] }, true)
    rb.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true)
  }

  setVelocity(body: number, v: Vec3, w: Vec3): void {
    const rb = this.rb(body)
    rb.setLinvel({ x: v[0], y: v[1], z: v[2] }, true)
    rb.setAngvel({ x: w[0], y: w[1], z: w[2] }, true)
  }

  moveKinematic(body: number, p: Vec3, q: Quat): void {
    const rb = this.rb(body)
    rb.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] })
    rb.setNextKinematicRotation({ x: q[0], y: q[1], z: q[2], w: q[3] })
  }

  applyImpulse(body: number, j: Vec3, point?: Vec3): void {
    const rb = this.rb(body)
    if (point) rb.applyImpulseAtPoint({ x: j[0], y: j[1], z: j[2] }, { x: point[0], y: point[1], z: point[2] }, true)
    else rb.applyImpulse({ x: j[0], y: j[1], z: j[2] }, true)
  }

  isSleeping(body: number): boolean {
    return this.rb(body).isSleeping()
  }

  sleep(body: number): void {
    this.rb(body).sleep()
  }

  wake(body: number): void {
    this.rb(body).wakeUp()
  }

  createJoint(d: JointDesc): number {
    const R = this.R
    const a = this.rb(d.a)
    const b = this.rb(d.b)
    const aa = { x: d.anchorA[0], y: d.anchorA[1], z: d.anchorA[2] }
    const ab = { x: d.anchorB[0], y: d.anchorB[1], z: d.anchorB[2] }
    const axis = d.axis ?? [1, 0, 0]
    const ax = { x: axis[0], y: axis[1], z: axis[2] }
    let data: RapierModule.JointData
    switch (d.kind) {
      case 'fixed':
        data = R.JointData.fixed(aa, { x: 0, y: 0, z: 0, w: 1 }, ab, { x: 0, y: 0, z: 0, w: 1 })
        break
      case 'hinge':
        data = R.JointData.revolute(aa, ab, ax)
        break
      case 'slider':
        data = R.JointData.prismatic(aa, ab, ax)
        break
      case 'rope':
        data = R.JointData.rope(d.length ?? 1, aa, ab)
        break
      case 'ball':
        // a ball whose x is the twist axis: a generic joint with the three linear axes locked, so per-axis angular limits can be set
        data = R.JointData.generic(aa, ab, ax, R.JointAxesMask.LinX | R.JointAxesMask.LinY | R.JointAxesMask.LinZ)
        break
    }
    const joint = this.world.createImpulseJoint(data, a, b, true)
    // rapier.js 0.21 drops `JointData.limits` for a revolute joint when it is made (only the prismatic constructor takes them): set on the joint afterwards
    if (d.range && (d.kind === 'hinge' || d.kind === 'slider')) (joint as RapierModule.UnitImpulseJoint).setLimits(d.range[0], d.range[1])
    joint.setContactsEnabled(d.contacts ?? false)
    const l = d.limits
    if (d.kind === 'ball' && l) {
      const raw = (joint as unknown as { rawSet: RawJointSet }).rawSet
      if (l.twist) raw.jointSetLimits(joint.handle, ANG_X, l.twist[0], l.twist[1])
      if (l.swingY) raw.jointSetLimits(joint.handle, ANG_Y, l.swingY[0], l.swingY[1])
      if (l.swingZ) raw.jointSetLimits(joint.handle, ANG_Z, l.swingZ[0], l.swingZ[1])
    }
    return joint.handle
  }

  removeJoint(joint: number): void {
    const j = this.world.getImpulseJoint(joint)
    if (j) this.world.removeImpulseJoint(j, true)
  }

  step(dt: number): void {
    if (dt <= 0) return
    const steps = Math.max(1, Math.ceil(dt / this.maxStep - 1e-9))
    this.world.timestep = dt / steps
    for (let i = 0; i < steps; i++) this.world.step(this.events)
  }

  private filterOf(f: QueryFilter | undefined): { flags: number | undefined; groups: number | undefined; exclude: RigidBody | undefined } {
    if (!f) return { flags: undefined, groups: undefined, exclude: undefined }
    return {
      flags: f.skipSensors ? this.R.QueryFilterFlags.EXCLUDE_SENSORS : undefined,
      groups: f.layers !== undefined ? (0xffff << 16) | (f.layers & 0xffff) : undefined,
      exclude: f.excludeBody !== undefined ? this.rb(f.excludeBody) : undefined,
    }
  }

  rayAll(origin: Vec3, direction: Vec3, maxDistance: number, out: RayHit[], filter?: QueryFilter): number {
    const r = this.ray
    r.origin.x = origin[0]
    r.origin.y = origin[1]
    r.origin.z = origin[2]
    r.dir.x = direction[0]
    r.dir.y = direction[1]
    r.dir.z = direction[2]
    const f = this.filterOf(filter)
    let n = 0
    this.world.intersectionsWithRay(
      r,
      maxDistance,
      true,
      (hit) => {
        if (n >= out.length) return false
        const slot = out[n++]
        slot.tag = this.tags.get(hit.collider.handle) ?? -1
        slot.body = hit.collider.parent()?.handle ?? -1
        slot.distance = hit.timeOfImpact
        slot.normal[0] = hit.normal.x
        slot.normal[1] = hit.normal.y
        slot.normal[2] = hit.normal.z
        return true
      },
      f.flags,
      f.groups,
      undefined,
      f.exclude,
    )
    // the engine hands hits in broadphase order: sorted here, in place
    const s = this.sorted
    s.length = n
    for (let i = 0; i < n; i++) s[i] = out[i]
    s.sort((x, y) => x.distance - y.distance)
    for (let i = 0; i < n; i++) out[i] = s[i]
    return n
  }

  rayFirst(origin: Vec3, direction: Vec3, maxDistance: number, out: RayHit, filter?: QueryFilter): boolean {
    const r = this.ray
    r.origin.x = origin[0]
    r.origin.y = origin[1]
    r.origin.z = origin[2]
    r.dir.x = direction[0]
    r.dir.y = direction[1]
    r.dir.z = direction[2]
    const f = this.filterOf(filter)
    const hit = this.world.castRayAndGetNormal(r, maxDistance, true, f.flags, f.groups, undefined, f.exclude)
    if (!hit) return false
    out.tag = this.tags.get(hit.collider.handle) ?? -1
    out.body = hit.collider.parent()?.handle ?? -1
    out.distance = hit.timeOfImpact
    out.normal[0] = hit.normal.x
    out.normal[1] = hit.normal.y
    out.normal[2] = hit.normal.z
    return true
  }

  sphereCast(origin: Vec3, direction: Vec3, radius: number, maxDistance: number, filter?: QueryFilter): RayHit | null {
    this.ball.radius = radius
    const f = this.filterOf(filter)
    const hit = this.world.castShape(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: direction[0], y: direction[1], z: direction[2] },
      this.ball,
      0,
      maxDistance,
      true,
      f.flags,
      f.groups,
      undefined,
      f.exclude,
    )
    if (!hit) return null
    return {
      tag: this.tags.get(hit.collider.handle) ?? -1,
      body: hit.collider.parent()?.handle ?? -1,
      distance: hit.time_of_impact,
      normal: [hit.normal2.x, hit.normal2.y, hit.normal2.z],
    }
  }

  overlapSphere(centre: Vec3, radius: number, out: Int32Array, filter?: QueryFilter): number {
    this.ball.radius = radius
    const f = this.filterOf(filter)
    let n = 0
    this.world.intersectionsWithShape(
      { x: centre[0], y: centre[1], z: centre[2] },
      { x: 0, y: 0, z: 0, w: 1 },
      this.ball,
      (c) => {
        if (n >= out.length) return false
        out[n++] = this.tags.get(c.handle) ?? -1
        return true
      },
      f.flags,
      f.groups,
      undefined,
      f.exclude,
    )
    return n
  }

  drainContactForces(f: (e: ContactForce) => void): void {
    const e = this.force
    this.events.drainContactForceEvents((ev) => {
      const a = this.world.getCollider(ev.collider1())
      const b = this.world.getCollider(ev.collider2())
      e.tagA = this.tags.get(ev.collider1()) ?? -1
      e.tagB = this.tags.get(ev.collider2()) ?? -1
      e.bodyA = a?.parent()?.handle ?? -1
      e.bodyB = b?.parent()?.handle ?? -1
      e.force = ev.totalForceMagnitude()
      const d = ev.maxForceDirection()
      e.direction[0] = d.x
      e.direction[1] = d.y
      e.direction[2] = d.z
      f(e)
    })
  }

  drainSensorEvents(f: (sensorTag: number, otherTag: number, entered: boolean) => void): void {
    this.events.drainCollisionEvents((h1, h2, started) => {
      const c1 = this.world.getCollider(h1)
      const sensorFirst = c1?.isSensor() ?? false
      const s = sensorFirst ? h1 : h2
      const o = sensorFirst ? h2 : h1
      f(this.tags.get(s) ?? -1, this.tags.get(o) ?? -1, started)
    })
  }

  setFriction(body: number, mu: number): void {
    const rb = this.rb(body)
    const f = Math.sqrt(mu)
    for (let i = 0; i < rb.numColliders(); i++) {
      const c = rb.collider(i)
      if (c.friction() !== f) c.setFriction(f)
    }
  }

  /** A pair kept apart: a rope joint longer than anything with contacts off between its bodies (Rapier's per-pair switch lives on joints; the JS hooks would cost a call per pair). */
  private readonly apart = new Map<string, number>()

  setPairContacts(a: number, b: number, enabled: boolean): void {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`
    const joint = this.apart.get(key)
    if (enabled) {
      if (joint === undefined) return
      this.removeJoint(joint)
      this.apart.delete(key)
      return
    }
    if (joint !== undefined) return
    const data = this.R.JointData.rope(1e6, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    const j = this.world.createImpulseJoint(data, this.rb(a), this.rb(b), true)
    j.setContactsEnabled(false)
    this.apart.set(key, j.handle)
  }

  overlapsDeeperThan(body: number, depth: number, kind: 'dynamic' | 'fixed' | 'kinematic', out: number[]): number {
    const rb = this.rb(body)
    const want = kind === 'dynamic' ? this.R.RigidBodyType.Dynamic : kind === 'fixed' ? this.R.RigidBodyType.Fixed : this.R.RigidBodyType.KinematicPositionBased
    let n = 0
    for (let i = 0; i < rb.numColliders(); i++) {
      const c = rb.collider(i)
      this.world.intersectionsWithShape(c.translation(), c.rotation(), c.shape, (other) => {
        const parent = other.parent()
        if (!parent || parent.handle === body || parent.bodyType() !== want || out.includes(parent.handle) || n >= out.length) return true
        const contact = c.contactCollider(other, 0)
        if (contact && contact.distance < -depth) out[n++] = parent.handle
        return true
      })
    }
    return n
  }

  distance(a: number, b: number, upTo: number): number {
    const ra = this.rb(a)
    const rb = this.rb(b)
    let least = upTo
    for (let i = 0; i < ra.numColliders(); i++) {
      for (let j = 0; j < rb.numColliders(); j++) {
        const contact = ra.collider(i).contactCollider(rb.collider(j), upTo)
        if (contact && contact.distance < least) least = contact.distance
      }
    }
    return least
  }

  touching(body: number): boolean {
    const rb = this.rb(body)
    let touching = false
    for (let i = 0; i < rb.numColliders() && !touching; i++) {
      const c = rb.collider(i)
      this.world.contactPairsWith(c, (other) => {
        if (touching) return
        this.world.contactPair(c, other, (m) => {
          if (m.numContacts() > 0) touching = true
        })
      })
    }
    return touching
  }

  snapshot(): Uint8Array {
    return this.world.takeSnapshot()
  }

  restore(bytes: Uint8Array): void {
    const restored = this.R.World.restoreSnapshot(bytes)
    // the snapshot carries bodies, colliders and joints with their handles: the side table of tags stays valid
    this.world.free()
    this.world = restored
  }

  dispose(): void {
    this.events.free()
    this.world.free()
  }
}

/** Loads Rapier's deterministic build (WebAssembly inlined as base64: works in node, vitest and the single-file room) and returns the engine. Async, once. */
export const loadRapierEngine = async (): Promise<PhysicsEngine> => {
  const R = (await import('@dimforge/rapier3d-deterministic-compat')) as unknown as Rapier
  await R.init()
  return createRapierEngine({ rapier: R, deterministic: true, name: 'rapier-deterministic' })
}
