import type JoltNS from 'jolt-physics/wasm-compat'

import { DEFAULT_MATERIAL, LAYERS, LAYER_PAIRS } from '@adatechnology/game-physics'
import type {
  BodyDesc,
  BodyId,
  JointDesc,
  JointId,
  Material,
  PhysicsWorld,
  QueryFilter,
  Quat,
  RagdollDesc,
  RagdollId,
  RayHit,
  Rolling,
  SensorEvent,
  ShapeDesc,
  Vec3,
  VehicleDesc,
  VehicleId,
  VehicleInput,
  WorldDesc,
} from '@adatechnology/game-physics'

import { createCharacter } from './character'
import { BP_AGENT, BP_MOVING, BP_SENSOR, BP_STATIC, INERTIA_SCALE, NUM_BP, NUM_OBJECT_LAYERS, POINTS_PER_BODY, QUERY_LAYER, ROW_CAPACITY, layerOf } from './constants'
import type { Jolt } from './constants'
import { Contacts, makeListener } from './contacts'
import type { BodyEntry, JointEntry, JoltCharacter, RagdollEntry, VehicleEntry } from './entries'
import { roll, touch, updateFriction } from './friction'
import { breakJoints, createGroup, createJoint, createRagdoll, jointAngles, removeJoint, removeRagdoll } from './joints'
import { overlapSphere, penetration, rayAll, rayFirst, sphereCastAll } from './queries'
import { makeShape } from './shapes'
import { restoreState, saveState } from './state'
import { createVehicle, driveVehicle, removeVehicle, vehicleBody, wheelContacts } from './vehicles'

/**
 * The kit's physics contract over one Jolt `PhysicsSystem`. Its fields without `private` are the adapter's own: the files beside this one (contacts, friction,
 * joints, vehicles, queries, state) work on them; nothing outside the package does.
 */
export class JoltWorld implements PhysicsWorld {
  readonly engine = 'jolt'
  readonly contacts = new Contacts()
  readonly sensorEvents: SensorEvent[] = []
  readonly brokenJoints: JointId[] = []
  readonly J: Jolt
  readonly iface: JoltNS.JoltInterface
  readonly system: JoltNS.PhysicsSystem
  readonly bi: JoltNS.BodyInterface
  readonly bodies = new Map<number, BodyEntry>()
  /** The same entries by the body's address in the wasm heap: what the contact listener is handed. */
  readonly byPointer = new Map<number, BodyEntry>()
  readonly joints = new Map<number, JointEntry>()
  readonly vehicles = new Map<number, VehicleEntry>()
  readonly ragdolls = new Map<number, RagdollEntry>()
  nextRagdoll = 1
  readonly groups: JoltNS.GroupFilterTable[] = []
  nextJoint = 1
  nextVehicle = 1
  readonly fixedStep: number
  private accumulator = 0
  readonly slipSpeed: number
  readonly reportSpeed: number
  readonly maxContacts: number
  readonly listener: JoltNS.ContactListenerJS
  // scratch objects, made once and destroyed in `dispose`
  readonly v1: JoltNS.Vec3
  readonly v2: JoltNS.Vec3
  readonly r1: JoltNS.RVec3
  readonly q1: JoltNS.Quat
  readonly ray: JoltNS.RRayCast
  readonly raySettings: JoltNS.RayCastSettings
  readonly rayCollector: JoltNS.CastRayAllHitCollisionCollector
  readonly rayClosest: JoltNS.CastRayClosestHitCollisionCollector
  readonly bpFilter: JoltNS.DefaultBroadPhaseLayerFilter
  readonly objFilter: JoltNS.DefaultObjectLayerFilter
  readonly bodyFilter: JoltNS.BodyFilter
  readonly shapeFilter: JoltNS.ShapeFilter
  readonly layerFilters = new Map<string, JoltNS.ObjectLayerFilterJS>()
  readonly collideSettings: JoltNS.CollideShapeSettings
  readonly collideCollector: JoltNS.CollideShapeAllHitCollisionCollector
  readonly castSettings: JoltNS.ShapeCastSettings
  readonly castCollector: JoltNS.CastShapeAllHitCollisionCollector
  readonly sphereShapes = new Map<number, JoltNS.Shape>()
  private readonly objectFilter: JoltNS.ObjectLayerPairFilterTable
  private readonly bpInterface: JoltNS.BroadPhaseLayerInterfaceTable
  private readonly objVsBp: JoltNS.ObjectVsBroadPhaseLayerFilterTable
  private disposed = false
  private readonly asserts: JoltNS.AssertFailedHandlerJS
  /** Contacts each body has now (added minus removed), for `touching`. */
  readonly touches = new Map<number, number>()
  /** The bodies each body touches now, with how many contacts each (`updateFriction`). */
  readonly partners = new Map<number, Map<number, number>>()
  readonly activeIds: JoltNS.BodyIDVector
  readonly ignored = new Set<number>()
  /** Contact points of the last step per body: up to `POINTS_PER_BODY` x y z, and how many. Kept for the bodies asked about (`contactPoints`). */
  readonly points = new Map<number, { xyz: Float32Array; n: number; step: number }>()
  stepCount = 0
  /** Bodies with rolling resistance (`BodyDesc.rolling`), by body key. */
  readonly rollers = new Map<number, Rolling>()
  readonly gravity: number

  constructor(J: Jolt, desc: WorldDesc) {
    this.J = J
    this.fixedStep = desc.fixedStep ?? 1 / 60
    this.slipSpeed = desc.slipSpeed ?? 0.02
    this.reportSpeed = desc.contactReportSpeed ?? 0.5
    this.maxContacts = Math.min(ROW_CAPACITY, desc.maxContacts ?? ROW_CAPACITY)
    const settings = new J.JoltSettings()
    settings.mMaxBodies = desc.maxBodies ?? 16384
    settings.mMaxBodyPairs = 32768
    settings.mMaxContactConstraints = 16384
    this.objectFilter = new J.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS)
    for (const [x, y] of LAYER_PAIRS) this.objectFilter.EnableCollision(layerOf(x), layerOf(y))
    for (let i = 0; i < LAYERS.length; i++) if (LAYERS[i] !== 'sensor') this.objectFilter.EnableCollision(QUERY_LAYER, i)
    this.bpInterface = new J.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_BP)
    const bp = [new J.BroadPhaseLayer(BP_STATIC), new J.BroadPhaseLayer(BP_MOVING), new J.BroadPhaseLayer(BP_AGENT), new J.BroadPhaseLayer(BP_SENSOR)]
    for (const layer of LAYERS) {
      const which = layer === 'static' ? BP_STATIC : layer === 'agent' ? BP_AGENT : layer === 'sensor' ? BP_SENSOR : BP_MOVING
      this.bpInterface.MapObjectToBroadPhaseLayer(layerOf(layer), bp[which])
    }
    this.bpInterface.MapObjectToBroadPhaseLayer(QUERY_LAYER, bp[BP_MOVING])
    for (const b of bp) J.destroy(b)
    this.objVsBp = new J.ObjectVsBroadPhaseLayerFilterTable(this.bpInterface, NUM_BP, this.objectFilter, NUM_OBJECT_LAYERS)
    settings.mObjectLayerPairFilter = this.objectFilter
    settings.mBroadPhaseLayerInterface = this.bpInterface
    settings.mObjectVsBroadPhaseLayerFilter = this.objVsBp
    // the debug build reports its asserts here (the release build has none)
    const asserts = new J.AssertFailedHandlerJS()
    this.asserts = asserts
    asserts.OnAssertFailed = (expression: number, message: number, file: number, line: number) => {
      const text = (ptr: number): string => {
        let out = ''
        for (let i = ptr; ptr && J.HEAPU8[i] !== 0 && i < ptr + 400; i++) out += String.fromCharCode(J.HEAPU8[i])
        return out
      }
      throw new Error(`jolt assert ${text(expression)} ${text(message)} ${text(file)}:${line}`)
    }
    settings.mAssertFailedHandler = asserts
    this.iface = new J.JoltInterface(settings)
    J.destroy(settings)
    this.system = this.iface.GetPhysicsSystem()
    this.bi = this.system.GetBodyInterface()
    const g = desc.gravity ?? [0, -9.81, 0]
    this.gravity = Math.hypot(g[0], g[1], g[2])
    this.v1 = new J.Vec3(g[0], g[1], g[2])
    this.system.SetGravity(this.v1)
    const ps = this.system.GetPhysicsSettings()
    if (desc.sleepAfter !== undefined) ps.mTimeBeforeSleep = desc.sleepAfter
    if (desc.sleepSpeed !== undefined) ps.mPointVelocitySleepThreshold = desc.sleepSpeed
    if (desc.velocityIterations !== undefined) ps.mNumVelocitySteps = desc.velocityIterations
    if (desc.positionIterations !== undefined) ps.mNumPositionSteps = desc.positionIterations
    if (desc.penetrationSlop !== undefined) ps.mPenetrationSlop = desc.penetrationSlop
    if (desc.maxPushOut !== undefined) ps.mMaxPenetrationDistance = desc.maxPushOut
    this.system.SetPhysicsSettings(ps)
    this.v2 = new J.Vec3(0, 0, 0)
    this.r1 = new J.RVec3(0, 0, 0)
    this.q1 = new J.Quat(0, 0, 0, 1)
    this.ray = new J.RRayCast()
    this.raySettings = new J.RayCastSettings()
    this.rayCollector = new J.CastRayAllHitCollisionCollector()
    this.rayClosest = new J.CastRayClosestHitCollisionCollector()
    this.bpFilter = new J.DefaultBroadPhaseLayerFilter(this.objVsBp, QUERY_LAYER)
    this.objFilter = new J.DefaultObjectLayerFilter(this.objectFilter, QUERY_LAYER)
    this.bodyFilter = new J.BodyFilter()
    this.shapeFilter = new J.ShapeFilter()
    this.collideSettings = new J.CollideShapeSettings()
    this.collideCollector = new J.CollideShapeAllHitCollisionCollector()
    this.castSettings = new J.ShapeCastSettings()
    this.castCollector = new J.CastShapeAllHitCollisionCollector()
    this.activeIds = new J.BodyIDVector()
    this.listener = makeListener(this)
    this.system.SetContactListener(this.listener)
  }

  makeShape(shape: ShapeDesc): JoltNS.Shape {
    return makeShape(this.J, this.v2, shape)
  }

  // Bodies ------------------------------------------------------------------------------------------------------------------------------

  private settingsFor(desc: BodyDesc, shape: JoltNS.Shape): JoltNS.BodyCreationSettings {
    const J = this.J
    const r = desc.rotation ?? [0, 0, 0, 1]
    this.r1.Set(desc.position[0], desc.position[1], desc.position[2])
    this.q1.Set(r[0], r[1], r[2], r[3])
    const motion = desc.motion === 'static' ? J.EMotionType_Static : desc.motion === 'kinematic' ? J.EMotionType_Kinematic : J.EMotionType_Dynamic
    const layer = desc.layer ?? (desc.motion === 'static' ? 'static' : 'debris')
    const s = new J.BodyCreationSettings(shape, this.r1, this.q1, motion, layerOf(layer))
    const material = desc.material ?? DEFAULT_MATERIAL
    // Jolt mixes two bodies' friction by geometric mean, as the kit does (`mixFriction`): each body holds its own coefficient, static until it slides
    s.mFriction = material.frictionStatic
    s.mRestitution = material.restitution
    s.mUserData = desc.user
    if (desc.linearDamping !== undefined) s.mLinearDamping = desc.linearDamping
    if (desc.angularDamping !== undefined) s.mAngularDamping = desc.angularDamping
    if (desc.continuous) s.mMotionQuality = J.EMotionQuality_LinearCast
    if (desc.allowSleep === false) s.mAllowSleeping = false
    if (desc.motion !== 'static') s.mAllowDynamicOrKinematic = true
    if (layer === 'sensor') {
      s.mIsSensor = true
      s.mCollideKinematicVsNonDynamic = true
    }
    // the inertia goes in `INERTIA_SCALE` times too large and is put right after the body is made (`unscaleInertia`): Jolt falls back to a 1 m sphere's inertia
    // for any body whose principal moments are near zero (|I| < 1e-6 kg m^2: a 9 mm casing, a 1.5 cm chip), 10 000 times too much for a casing
    if (desc.motion === 'dynamic' && desc.mass !== undefined && desc.inertia) {
      s.mOverrideMassProperties = J.EOverrideMassProperties_MassAndInertiaProvided
      s.mMassPropertiesOverride.mMass = desc.mass
      this.v2.Set(desc.inertia[0] * INERTIA_SCALE, desc.inertia[1] * INERTIA_SCALE, desc.inertia[2] * INERTIA_SCALE)
      s.mMassPropertiesOverride.mInertia = J.Mat44.prototype.sScaleVec3(this.v2)
    } else if (desc.motion === 'dynamic' && desc.mass !== undefined) {
      // the shape's inertia is scaled to the mass given: to `INERTIA_SCALE` times it, then the mass alone is put back
      s.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia
      s.mMassPropertiesOverride.mMass = desc.mass * INERTIA_SCALE
    }
    if (desc.group) {
      const filter = this.groups[desc.group.id]
      if (filter) {
        const group = new J.CollisionGroup(filter, desc.group.id, desc.group.sub)
        s.mCollisionGroup = group
        J.destroy(group)
      }
    }
    if (desc.linearVelocity) s.mLinearVelocity.Set(desc.linearVelocity[0], desc.linearVelocity[1], desc.linearVelocity[2])
    if (desc.angularVelocity) s.mAngularVelocity.Set(desc.angularVelocity[0], desc.angularVelocity[1], desc.angularVelocity[2])
    return s
  }

  /** Puts back the mass and inertia `settingsFor` gave `INERTIA_SCALE` times too large: same principal axes, the true moments. */
  private unscaleInertia(desc: BodyDesc, body: JoltNS.Body): void {
    if (desc.motion !== 'dynamic' || desc.mass === undefined) return
    const mp = body.GetMotionProperties()
    const d = mp.GetInverseInertiaDiagonal()
    this.v2.Set(d.GetX() * INERTIA_SCALE, d.GetY() * INERTIA_SCALE, d.GetZ() * INERTIA_SCALE)
    mp.SetInverseInertia(this.v2, mp.GetInertiaRotation())
    mp.SetInverseMass(1 / desc.mass)
  }

  private register(desc: BodyDesc, body: JoltNS.Body): BodyId {
    const id = body.GetID()
    const key = id.GetIndexAndSequenceNumber()
    if (desc.rolling && desc.motion === 'dynamic') this.rollers.set(key, desc.rolling)
    const mp = desc.motion === 'dynamic' ? body.GetMotionProperties().GetInverseMass() : 0
    const entry: BodyEntry = {
      body,
      id: new this.J.BodyID(key),
      key,
      user: desc.user,
      layer: desc.layer ?? (desc.motion === 'static' ? 'static' : 'debris'),
      material: desc.material ?? DEFAULT_MATERIAL,
      invMass: mp,
      kitMass: desc.motion === 'dynamic' && desc.mass !== undefined ? { mass: desc.mass, ...(desc.inertia ? { inertia: desc.inertia } : {}) } : null,
      sliding: false,
    }
    this.bodies.set(key, entry)
    this.byPointer.set(this.J.getPointer(body), entry)
    return key as BodyId
  }

  createBody(desc: BodyDesc): BodyId {
    const shape = this.makeShape(desc.shape)
    const s = this.settingsFor(desc, shape)
    const body = this.bi.CreateBody(s)
    this.J.destroy(s)
    shape.Release()
    this.unscaleInertia(desc, body)
    const key = this.register(desc, body)
    this.bi.AddBody(body.GetID(), desc.sleeping || desc.motion === 'static' ? this.J.EActivation_DontActivate : this.J.EActivation_Activate)
    return key
  }

  createBodies(descs: readonly BodyDesc[]): BodyId[] {
    const J = this.J
    if (descs.length === 0) return []
    // a Jolt array is the heap buffer the batch add reads (this build exports no malloc); a BodyID is one uint32
    const ids = new J.ArrayUint()
    ids.resize(descs.length)
    const base = J.getPointer(ids.data()) >> 2
    const out: BodyId[] = []
    for (let i = 0; i < descs.length; i++) {
      const shape = this.makeShape(descs[i].shape)
      const s = this.settingsFor(descs[i], shape)
      const body = this.bi.CreateBody(s)
      J.destroy(s)
      shape.Release()
      this.unscaleInertia(descs[i], body)
      out.push(this.register(descs[i], body))
      J.HEAPU32[base + i] = body.GetID().GetIndexAndSequenceNumber()
    }
    const ref = J.wrapPointer(J.getPointer(ids.data()), J.BodyIDMemRef)
    const state = this.bi.AddBodiesPrepare(ref, descs.length)
    this.bi.AddBodiesFinalize(ref, descs.length, state, J.EActivation_DontActivate)
    J.destroy(ids)
    for (let i = 0; i < descs.length; i++) if (!descs[i].sleeping && descs[i].motion !== 'static') this.bi.ActivateBody(this.entry(out[i]).id)
    return out
  }

  removeBody(id: BodyId): void {
    const e = this.bodies.get(id)
    if (!e) return
    this.byPointer.delete(this.J.getPointer(e.body))
    this.bi.RemoveBody(e.id)
    this.bi.DestroyBody(e.id)
    this.J.destroy(e.id)
    this.forget(id)
  }

  /** What the adapter keeps about a body that went (removed, or its ragdoll destroyed). */
  forget(id: number): void {
    this.bodies.delete(id)
    this.touches.delete(id)
    this.partners.delete(id)
    this.points.delete(id)
    this.rollers.delete(id)
  }

  /**
   * A new shape on the same body (what touches it keeps its cached contacts to warm start from). A dynamic body keeps the kit's mass (`mass`, else the one it
   * was made with), with its inertia from the new shape scaled to that mass (or the moments given), through the same small-inertia guard as `createBody`:
   * left to Jolt, the mass is the new shape's volume times 1000 kg/m^3 and a small piece's inertia becomes a 1 m sphere's.
   */
  setShape(id: BodyId, shape: ShapeDesc, mass?: { readonly mass: number; readonly inertia?: Vec3 }): void {
    const e = this.entry(id)
    const made = this.makeShape(shape)
    const dynamic = e.body.IsDynamic()
    if (mass && dynamic) e.kitMass = mass
    const kit = dynamic ? e.kitMass : null
    this.bi.SetShape(e.id, made, dynamic && !kit, this.J.EActivation_Activate)
    if (kit) this.putMass(e, made, kit)
    made.Release()
  }

  /** The kit's mass and moments on a body, with its new shape: made `INERTIA_SCALE` times too large for Jolt, then the true values put back (`unscaleInertia`). */
  private putMass(e: BodyEntry, shape: JoltNS.Shape, kit: { readonly mass: number; readonly inertia?: Vec3 }): void {
    const J = this.J
    const mp = e.body.GetMotionProperties()
    const props = new J.MassProperties()
    if (kit.inertia) {
      props.mMass = kit.mass * INERTIA_SCALE
      this.v2.Set(kit.inertia[0] * INERTIA_SCALE, kit.inertia[1] * INERTIA_SCALE, kit.inertia[2] * INERTIA_SCALE)
      props.mInertia = J.Mat44.prototype.sScaleVec3(this.v2)
    } else {
      const own = shape.GetMassProperties()
      props.mMass = own.mMass
      props.mInertia = own.mInertia
      props.ScaleToMass(kit.mass * INERTIA_SCALE)
    }
    mp.SetMassProperties(J.EAllowedDOFs_All, props)
    J.destroy(props)
    const d = mp.GetInverseInertiaDiagonal()
    this.v2.Set(d.GetX() * INERTIA_SCALE, d.GetY() * INERTIA_SCALE, d.GetZ() * INERTIA_SCALE)
    mp.SetInverseInertia(this.v2, mp.GetInertiaRotation())
    mp.SetInverseMass(1 / kit.mass)
    e.invMass = 1 / kit.mass
  }

  /** A dynamic body's mass and its moments about its own axes (kg m^2), as Jolt holds them: for checks. */
  massProperties(id: BodyId): { mass: number; inertia: Vec3 } {
    const mp = this.entry(id).body.GetMotionProperties()
    const m = mp.GetLocalSpaceInverseInertia()
    return { mass: 1 / mp.GetInverseMass(), inertia: [1 / m.GetAxisX().GetX(), 1 / m.GetAxisY().GetY(), 1 / m.GetAxisZ().GetZ()] }
  }

  entry(id: BodyId): BodyEntry {
    const e = this.bodies.get(id)
    if (!e) throw new Error(`game-physics-jolt: no body ${id}`)
    return e
  }

  readPose(id: BodyId, out: Float32Array | Float64Array, offset: number): void {
    const b = this.entry(id).body
    const p = b.GetPosition()
    const q = b.GetRotation()
    out[offset] = p.GetX()
    out[offset + 1] = p.GetY()
    out[offset + 2] = p.GetZ()
    out[offset + 3] = q.GetX()
    out[offset + 4] = q.GetY()
    out[offset + 5] = q.GetZ()
    out[offset + 6] = q.GetW()
  }

  readVelocity(id: BodyId, out: Float32Array | Float64Array, offset: number): void {
    const b = this.entry(id).body
    const v = b.GetLinearVelocity()
    out[offset] = v.GetX()
    out[offset + 1] = v.GetY()
    out[offset + 2] = v.GetZ()
    const w = b.GetAngularVelocity()
    out[offset + 3] = w.GetX()
    out[offset + 4] = w.GetY()
    out[offset + 5] = w.GetZ()
  }

  setPose(id: BodyId, position: Vec3, rotation: Quat, wake: boolean): void {
    this.r1.Set(position[0], position[1], position[2])
    this.q1.Set(rotation[0], rotation[1], rotation[2], rotation[3])
    this.bi.SetPositionAndRotation(this.entry(id).id, this.r1, this.q1, wake ? this.J.EActivation_Activate : this.J.EActivation_DontActivate)
  }

  setVelocity(id: BodyId, linear: Vec3, angular: Vec3): void {
    this.v1.Set(linear[0], linear[1], linear[2])
    this.v2.Set(angular[0], angular[1], angular[2])
    this.bi.SetLinearAndAngularVelocity(this.entry(id).id, this.v1, this.v2)
  }

  moveKinematic(id: BodyId, position: Vec3, rotation: Quat, dt: number): void {
    this.r1.Set(position[0], position[1], position[2])
    this.q1.Set(rotation[0], rotation[1], rotation[2], rotation[3])
    this.bi.MoveKinematic(this.entry(id).id, this.r1, this.q1, dt)
  }

  addImpulse(id: BodyId, impulse: Vec3, point?: Vec3): void {
    const e = this.entry(id)
    this.v1.Set(impulse[0], impulse[1], impulse[2])
    if (point) {
      this.r1.Set(point[0], point[1], point[2])
      this.bi.AddImpulse(e.id, this.v1, this.r1)
    } else this.bi.AddImpulse(e.id, this.v1)
  }

  isSleeping(id: BodyId): boolean {
    return !this.entry(id).body.IsActive()
  }

  wake(id: BodyId): void {
    this.bi.ActivateBody(this.entry(id).id)
  }

  sleep(id: BodyId): void {
    this.bi.DeactivateBody(this.entry(id).id)
  }

  wakeInBox(min: Vec3, max: Vec3): void {
    const J = this.J
    const a = new J.Vec3(min[0], min[1], min[2])
    const b = new J.Vec3(max[0], max[1], max[2])
    const box = new J.AABox(a, b)
    this.bi.ActivateBodiesInAABox(box, this.bpFilter, this.objFilter)
    J.destroy(box)
    J.destroy(a)
    J.destroy(b)
  }

  setMaterial(id: BodyId, material: Material): void {
    const e = this.entry(id)
    e.material = material
    this.bi.SetFriction(e.id, e.sliding ? material.frictionDynamic : material.frictionStatic)
    this.bi.SetRestitution(e.id, material.restitution)
  }

  setRolling(id: BodyId, rolling: Rolling | undefined): void {
    this.entry(id)
    if (rolling) this.rollers.set(id, rolling)
    else this.rollers.delete(id)
  }

  setMotion(id: BodyId, motion: 'kinematic' | 'dynamic'): void {
    this.bi.SetMotionType(this.entry(id).id, motion === 'kinematic' ? this.J.EMotionType_Kinematic : this.J.EMotionType_Dynamic, this.J.EActivation_Activate)
  }

  contactPoints(id: BodyId, out: Float32Array): number {
    let p = this.points.get(id)
    if (!p) {
      // asked about from now on: recorded from the next step
      p = { xyz: new Float32Array(POINTS_PER_BODY * 3), n: 0, step: -1 }
      this.points.set(id, p)
      return 0
    }
    if (p.step !== this.stepCount) return 0
    const n = Math.min(p.n, out.length / 3)
    out.set(p.xyz.subarray(0, n * 3))
    return n
  }

  touching(id: BodyId): boolean {
    return (this.touches.get(id) ?? 0) > 0
  }

  touch(key: number, other: number, by: number): void {
    touch(this, key, other, by)
  }

  pairKey(a: number, b: number): number {
    // body keys are index + sequence in 32 bits; the low 16 bits of each are enough within one world of under 65536 bodies
    const x = a & 0xffff
    const y = b & 0xffff
    return x < y ? x * 65536 + y : y * 65536 + x
  }

  ignorePair(a: BodyId, b: BodyId, ignore: boolean): void {
    const key = this.pairKey(a, b)
    if (ignore === this.ignored.has(key)) return
    if (ignore) this.ignored.add(key)
    else this.ignored.delete(key)
    // the body pair cache would keep the pair's contact: it is looked at again
    this.bi.InvalidateContactCache(this.entry(a).id)
  }

  get bodyCount(): number {
    return this.bodies.size
  }

  get activeCount(): number {
    return this.system.GetNumActiveBodies(this.J.EBodyType_RigidBody)
  }

  // Joints, ragdolls, vehicles, characters (`joints.ts`, `vehicles.ts`, `character.ts`) ---------------------------------------------------

  createGroup(subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number {
    return createGroup(this, subCount, disabledPairs)
  }

  createJoint(desc: JointDesc): JointId {
    return createJoint(this, desc)
  }

  createRagdoll(desc: RagdollDesc): { readonly id: RagdollId; readonly bodies: readonly BodyId[]; readonly joints: readonly JointId[] } {
    return createRagdoll(this, desc)
  }

  removeRagdoll(id: RagdollId): void {
    removeRagdoll(this, id)
  }

  removeJoint(id: JointId): void {
    removeJoint(this, id)
  }

  jointAngles(id: JointId): { swing: number; twist: number; hinge: number } {
    return jointAngles(this, id)
  }

  createVehicle(desc: VehicleDesc): VehicleId {
    return createVehicle(this, desc)
  }

  driveVehicle(id: VehicleId, input: VehicleInput): void {
    driveVehicle(this, id, input)
  }

  vehicleBody(id: VehicleId): BodyId {
    return vehicleBody(this, id)
  }

  removeVehicle(id: VehicleId): void {
    removeVehicle(this, id)
  }

  wheelContacts(id: VehicleId): number {
    return wheelContacts(this, id)
  }

  createCharacter(at: Vec3, radius: number, halfHeight: number, mass: number, strength: number): JoltCharacter {
    return createCharacter(this, at, { radius, halfHeight, mass, strength })
  }

  // Queries (`queries.ts`) ----------------------------------------------------------------------------------------------------------------

  rayAll(from: Vec3, direction: Vec3, length: number, out: RayHit[], filter?: QueryFilter): number {
    return rayAll(this, { from, direction, length }, out, filter)
  }

  rayFirst(from: Vec3, direction: Vec3, length: number, filter?: QueryFilter): RayHit | null {
    return rayFirst(this, { from, direction, length }, filter)
  }

  overlapSphere(center: Vec3, radius: number, out: BodyId[], filter?: QueryFilter): number {
    return overlapSphere(this, { center, radius }, out, filter)
  }

  penetration(id: BodyId, out: Float64Array): number {
    return penetration(this, id, out)
  }

  sphereCastAll(from: Vec3, direction: Vec3, length: number, radius: number, out: RayHit[], filter?: QueryFilter): number {
    return sphereCastAll(this, { from, direction, length, radius }, out, filter)
  }

  // Step --------------------------------------------------------------------------------------------------------------------------------

  /** Runs every whole fixed step in `dt` (the rest waits for the next call). Contacts and sensor events are those of these steps. */
  step(dt: number): void {
    this.contacts.count = 0
    this.sensorEvents.length = 0
    this.accumulator += dt
    let steps = 0
    while (this.accumulator >= this.fixedStep - 1e-9) {
      this.accumulator -= this.fixedStep
      this.stepCount++
      this.iface.Step(this.fixedStep, 1)
      if (this.rollers.size > 0) roll(this, this.fixedStep)
      breakJoints(this, this.fixedStep)
      steps++
    }
    if (steps > 0) updateFriction(this)
    if (steps === 0) this.brokenJoints.length = 0
  }

  saveState(): Uint8Array {
    return saveState(this)
  }

  restoreState(data: Uint8Array): boolean {
    return restoreState(this, data)
  }

  /** The whole wasm heap (bytes): fixed in this build, shared by every world. */
  memoryTotal(): number {
    return this.iface.sGetTotalMemory()
  }

  memoryInUse(): number {
    return this.iface.sGetTotalMemory() - this.iface.sGetFreeMemory()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const J = this.J
    for (const id of [...this.vehicles.keys()]) this.removeVehicle(id as VehicleId)
    for (const id of [...this.ragdolls.keys()]) this.removeRagdoll(id as RagdollId)
    for (const id of [...this.joints.keys()]) this.removeJoint(id as JointId)
    for (const id of [...this.bodies.keys()]) this.removeBody(id as BodyId)
    for (const s of this.sphereShapes.values()) s.Release()
    for (const g of this.groups) g.Release()
    for (const f of this.layerFilters.values()) J.destroy(f)
    for (const o of [this.v1, this.v2, this.r1, this.q1, this.ray, this.raySettings, this.rayCollector, this.rayClosest, this.bpFilter, this.objFilter, this.bodyFilter, this.shapeFilter, this.collideSettings, this.collideCollector, this.castSettings, this.castCollector, this.activeIds]) J.destroy(o)
    J.destroy(this.iface)
    J.destroy(this.listener)
    J.destroy(this.asserts)
  }
}
