/**
 * @adatechnology/game-physics-jolt (spike): the kit's physics contract over Jolt Physics (JoltPhysics.js, single-threaded `wasm-compat` build: the
 * wasm is inlined in the JS, so node, vitest and the single-file test room load it with no loader config; no SharedArrayBuffer, no COOP/COEP).
 * Every Jolt object this file creates is destroyed by it (`Jolt.destroy`, `RemoveBody`/`DestroyBody`, `Release`): CLAUDE.md §8.
 */
import initJolt from 'jolt-physics/wasm-compat'
import type JoltNS from 'jolt-physics/wasm-compat'

import { DEFAULT_MATERIAL, LAYERS, LAYER_PAIRS, mixFriction } from '@adatechnology/game-physics'
import type {
  BodyDesc,
  BodyId,
  ContactBuffer,
  JointDesc,
  JointId,
  Layer,
  Material,
  PhysicsEngine,
  PhysicsWorld,
  QueryFilter,
  Quat,
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

type Jolt = typeof JoltNS

let loaded: Promise<Jolt> | null = null

/** Loads the wasm once (async: the browser does not compile a module this size synchronously on the main thread). */
export const loadJolt = (): Promise<Jolt> => (loaded ??= initJolt())

/** The engine, once loaded: `createWorld` is synchronous. */
export const createJoltEngine = async (): Promise<PhysicsEngine & { readonly jolt: Jolt }> => {
  const jolt = await loadJolt()
  return { name: 'jolt', jolt, createWorld: (desc?: WorldDesc) => new JoltWorld(jolt, desc ?? {}) }
}

/** Object layers: the contract's layers, plus one the queries run as (meets everything but sensors). */
const LAYER_INDEX = new Map<Layer, number>(LAYERS.map((layer, i) => [layer, i]))
const QUERY_LAYER = LAYERS.length
const NUM_OBJECT_LAYERS = LAYERS.length + 1
/** Broadphase layers: what does not move, what moves, and the crowd agents (many, kinematic, moved every frame). */
const BP_STATIC = 0
const BP_MOVING = 1
const BP_AGENT = 2
const BP_SENSOR = 3
const NUM_BP = 4

interface BodyEntry {
  readonly body: JoltNS.Body
  readonly id: JoltNS.BodyID
  readonly user: number
  readonly layer: Layer
  material: Material
  readonly invMass: number
}

interface JointEntry {
  readonly constraint: JoltNS.TwoBodyConstraint
  readonly kind: JointDesc['kind']
  readonly breakImpulse: number
  readonly hinge: JoltNS.HingeConstraint | null
  readonly swing: JoltNS.SwingTwistConstraint | null
}

interface VehicleEntry {
  readonly body: BodyId
  readonly constraint: JoltNS.VehicleConstraint
  readonly controller: JoltNS.WheeledVehicleController
  readonly listener: JoltNS.VehicleConstraintStepListener
  readonly tester: JoltNS.VehicleCollisionTester
}

export interface JoltCharacter {
  update(dt: number, vx: number, vz: number): void
  position(out: Float64Array): void
  supported(): boolean
  dispose(): void
}

const ROW_CAPACITY = 4096
/** Height field blocks (samples a side) and Jolt's value for a sample with no ground (`HeightFieldShapeConstants::cNoCollisionValue`, FLT_MAX). */
const HEIGHT_BLOCK = 4
const NO_COLLISION = 3.4028234663852886e38
/** How much larger the inertia a dynamic body is made with is than its own (see `settingsFor`). */
const INERTIA_SCALE = 1e6
const POINTS_PER_BODY = 16

class Contacts implements ContactBuffer {
  count = 0
  readonly a = new Int32Array(ROW_CAPACITY)
  readonly b = new Int32Array(ROW_CAPACITY)
  readonly userA = new Int32Array(ROW_CAPACITY)
  readonly userB = new Int32Array(ROW_CAPACITY)
  readonly tagA = new Int32Array(ROW_CAPACITY)
  readonly tagB = new Int32Array(ROW_CAPACITY)
  readonly point = new Float32Array(ROW_CAPACITY * 3)
  readonly normal = new Float32Array(ROW_CAPACITY * 3)
  readonly approach = new Float32Array(ROW_CAPACITY)
  readonly impulse = new Float32Array(ROW_CAPACITY)
}

export class JoltWorld implements PhysicsWorld {
  readonly engine = 'jolt'
  readonly contacts = new Contacts()
  readonly sensorEvents: SensorEvent[] = []
  readonly brokenJoints: JointId[] = []
  private readonly J: Jolt
  private readonly iface: JoltNS.JoltInterface
  private readonly system: JoltNS.PhysicsSystem
  private readonly bi: JoltNS.BodyInterface
  private readonly bodies = new Map<number, BodyEntry>()
  private readonly joints = new Map<number, JointEntry>()
  private readonly vehicles = new Map<number, VehicleEntry>()
  private readonly groups: JoltNS.GroupFilterTable[] = []
  private nextJoint = 1
  private nextVehicle = 1
  private readonly fixedStep: number
  private accumulator = 0
  private readonly slipSpeed: number
  private readonly reportSpeed: number
  private readonly maxContacts: number
  private readonly listener: JoltNS.ContactListenerJS
  // scratch objects, made once and destroyed in `dispose`
  private readonly v1: JoltNS.Vec3
  private readonly v2: JoltNS.Vec3
  private readonly r1: JoltNS.RVec3
  private readonly q1: JoltNS.Quat
  private readonly ray: JoltNS.RRayCast
  private readonly raySettings: JoltNS.RayCastSettings
  private readonly rayCollector: JoltNS.CastRayAllHitCollisionCollector
  private readonly rayClosest: JoltNS.CastRayClosestHitCollisionCollector
  private readonly bpFilter: JoltNS.DefaultBroadPhaseLayerFilter
  private readonly objFilter: JoltNS.DefaultObjectLayerFilter
  private readonly bodyFilter: JoltNS.BodyFilter
  private readonly shapeFilter: JoltNS.ShapeFilter
  private readonly layerFilters = new Map<string, JoltNS.ObjectLayerFilterJS>()
  private readonly collideSettings: JoltNS.CollideShapeSettings
  private readonly collideCollector: JoltNS.CollideShapeAllHitCollisionCollector
  private readonly castSettings: JoltNS.ShapeCastSettings
  private readonly castCollector: JoltNS.CastShapeAllHitCollisionCollector
  private readonly sphereShapes = new Map<number, JoltNS.Shape>()
  private readonly objectFilter: JoltNS.ObjectLayerPairFilterTable
  private readonly bpInterface: JoltNS.BroadPhaseLayerInterfaceTable
  private readonly objVsBp: JoltNS.ObjectVsBroadPhaseLayerFilterTable
  private disposed = false
  /** Contacts each body has now (added minus removed), for `touching`. */
  private readonly touches = new Map<number, number>()
  private readonly ignored = new Set<number>()
  /** Contact points of the last step per body: up to `POINTS_PER_BODY` x y z, and how many. Kept for the bodies asked about (`contactPoints`). */
  private readonly points = new Map<number, { xyz: Float32Array; n: number; step: number }>()
  private stepCount = 0
  /** Bodies with rolling resistance (`BodyDesc.rolling`), by body key. */
  private readonly rollers = new Map<number, Rolling>()
  private readonly gravity: number

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
    for (const [x, y] of LAYER_PAIRS) this.objectFilter.EnableCollision(this.layerOf(x), this.layerOf(y))
    for (let i = 0; i < LAYERS.length; i++) if (LAYERS[i] !== 'sensor') this.objectFilter.EnableCollision(QUERY_LAYER, i)
    this.bpInterface = new J.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_BP)
    const bp = [new J.BroadPhaseLayer(BP_STATIC), new J.BroadPhaseLayer(BP_MOVING), new J.BroadPhaseLayer(BP_AGENT), new J.BroadPhaseLayer(BP_SENSOR)]
    for (const layer of LAYERS) {
      const which = layer === 'static' ? BP_STATIC : layer === 'agent' ? BP_AGENT : layer === 'sensor' ? BP_SENSOR : BP_MOVING
      this.bpInterface.MapObjectToBroadPhaseLayer(this.layerOf(layer), bp[which])
    }
    this.bpInterface.MapObjectToBroadPhaseLayer(QUERY_LAYER, bp[BP_MOVING])
    for (const b of bp) J.destroy(b)
    this.objVsBp = new J.ObjectVsBroadPhaseLayerFilterTable(this.bpInterface, NUM_BP, this.objectFilter, NUM_OBJECT_LAYERS)
    settings.mObjectLayerPairFilter = this.objectFilter
    settings.mBroadPhaseLayerInterface = this.bpInterface
    settings.mObjectVsBroadPhaseLayerFilter = this.objVsBp
    // the debug build reports its asserts here (the release build has none)
    const asserts = new J.AssertFailedHandlerJS()
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
    this.listener = this.makeListener()
    this.system.SetContactListener(this.listener)
  }

  private layerOf(layer: Layer): number {
    return LAYER_INDEX.get(layer) ?? 0
  }

  // Shapes ------------------------------------------------------------------------------------------------------------------------------

  private shapeSettings(shape: ShapeDesc): JoltNS.ShapeSettings {
    const J = this.J
    switch (shape.kind) {
      case 'box': {
        const smallest = Math.min(shape.half[0], shape.half[1], shape.half[2])
        this.v2.Set(shape.half[0], shape.half[1], shape.half[2])
        // the convex radius rounds the edges; kept under a fifth of the thinnest half so a 4 cm plate stays a plate
        return new J.BoxShapeSettings(this.v2, Math.min(0.05, smallest * 0.2))
      }
      case 'sphere':
        return new J.SphereShapeSettings(shape.radius)
      case 'capsule':
        return new J.CapsuleShapeSettings(shape.halfHeight, shape.radius)
      case 'cylinder':
        return new J.CylinderShapeSettings(shape.halfHeight, shape.radius, Math.min(0.05, shape.radius * 0.2))
      case 'convex': {
        const s = new J.ConvexHullShapeSettings()
        for (let i = 0; i < shape.points.length; i += 3) {
          this.v2.Set(shape.points[i], shape.points[i + 1], shape.points[i + 2])
          s.mPoints.push_back(this.v2)
        }
        return s
      }
      case 'trimesh': {
        const verts = new J.VertexList()
        const tris = new J.IndexedTriangleList()
        const f3 = new J.Float3(0, 0, 0)
        verts.reserve(shape.vertices.length / 3)
        for (let i = 0; i < shape.vertices.length; i += 3) {
          f3.x = shape.vertices[i]
          f3.y = shape.vertices[i + 1]
          f3.z = shape.vertices[i + 2]
          verts.push_back(f3)
        }
        tris.reserve(shape.indices.length / 3)
        const t = new J.IndexedTriangle(0, 0, 0, 0, 0)
        for (let i = 0; i < shape.indices.length; i += 3) {
          // Jolt winds triangles counter-clockwise seen from the front; ours are three.js order (also counter-clockwise)
          t.set_mIdx(0, shape.indices[i])
          t.set_mIdx(1, shape.indices[i + 1])
          t.set_mIdx(2, shape.indices[i + 2])
          tris.push_back(t)
        }
        const materials = new J.PhysicsMaterialList()
        const s = new J.MeshShapeSettings(verts, tris, materials)
        J.destroy(f3)
        J.destroy(t)
        J.destroy(verts)
        J.destroy(tris)
        J.destroy(materials)
        return s
      }
      case 'heightfield': {
        const s = new J.HeightFieldShapeSettings()
        s.mOffset.Set(shape.origin[0], shape.origin[1], shape.origin[2])
        s.mScale.Set(shape.cell, 1, shape.cell)
        // Jolt takes a multiple of the block size: the samples past `size` are holes, so the field ends where ours does
        const count = Math.ceil(shape.size / HEIGHT_BLOCK) * HEIGHT_BLOCK
        s.mSampleCount = count
        s.mBlockSize = HEIGHT_BLOCK
        s.mBitsPerSample = 8
        s.mHeightSamples.resize(count * count)
        const ptr = J.getPointer(s.mHeightSamples.data()) >> 2
        for (let z = 0; z < count; z++) {
          for (let x = 0; x < count; x++) J.HEAPF32[ptr + z * count + x] = x < shape.size && z < shape.size ? shape.heights[z * shape.size + x] : NO_COLLISION
        }
        return s
      }
      case 'compound': {
        const s = new J.StaticCompoundShapeSettings()
        for (const child of shape.children) {
          const inner = this.shapeSettings(child.shape)
          const r = child.rotation ?? [0, 0, 0, 1]
          const pos = new J.Vec3(child.position[0], child.position[1], child.position[2])
          const rot = new J.Quat(r[0], r[1], r[2], r[3])
          s.AddShape(pos, rot, inner, child.tag ?? 0)
          J.destroy(pos)
          J.destroy(rot)
        }
        return s
      }
    }
  }

  private makeShape(shape: ShapeDesc): JoltNS.Shape {
    const settings = this.shapeSettings(shape)
    const result = settings.Create()
    if (result.HasError()) {
      const message = result.GetError().c_str()
      this.J.destroy(result)
      throw new Error(`game-physics-jolt: ${shape.kind} shape: ${message}`)
    }
    const made = result.Get()
    // the body takes its own reference; the settings and the result (which also hold one) go
    made.AddRef()
    this.J.destroy(result)
    this.J.destroy(settings)
    return made
  }

  // Bodies ------------------------------------------------------------------------------------------------------------------------------

  private settingsFor(desc: BodyDesc, shape: JoltNS.Shape): JoltNS.BodyCreationSettings {
    const J = this.J
    const r = desc.rotation ?? [0, 0, 0, 1]
    this.r1.Set(desc.position[0], desc.position[1], desc.position[2])
    this.q1.Set(r[0], r[1], r[2], r[3])
    const motion = desc.motion === 'static' ? J.EMotionType_Static : desc.motion === 'kinematic' ? J.EMotionType_Kinematic : J.EMotionType_Dynamic
    const layer = desc.layer ?? (desc.motion === 'static' ? 'static' : 'debris')
    const s = new J.BodyCreationSettings(shape, this.r1, this.q1, motion, this.layerOf(layer))
    const material = desc.material ?? DEFAULT_MATERIAL
    s.mFriction = Math.sqrt(material.frictionStatic)
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
    this.bodies.set(key, {
      body,
      id: new this.J.BodyID(key),
      user: desc.user,
      layer: desc.layer ?? (desc.motion === 'static' ? 'static' : 'debris'),
      material: desc.material ?? DEFAULT_MATERIAL,
      invMass: mp,
    })
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
    this.bi.RemoveBody(e.id)
    this.bi.DestroyBody(e.id)
    this.J.destroy(e.id)
    this.bodies.delete(id)
    this.touches.delete(id)
    this.points.delete(id)
    this.rollers.delete(id)
  }

  setShape(id: BodyId, shape: ShapeDesc): void {
    const e = this.entry(id)
    const made = this.makeShape(shape)
    // a static body has no mass to update; the body keeps its id, so what touches it keeps its cached contacts to warm start from
    this.bi.SetShape(e.id, made, e.body.IsDynamic(), this.J.EActivation_Activate)
    made.Release()
  }

  private entry(id: BodyId): BodyEntry {
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
    this.bi.SetFriction(e.id, Math.sqrt(material.frictionStatic))
    this.bi.SetRestitution(e.id, material.restitution)
  }

  setRolling(id: BodyId, rolling: Rolling | undefined): void {
    this.entry(id)
    if (rolling) this.rollers.set(id, rolling)
    else this.rollers.delete(id)
  }

  /**
   * Rolling resistance, after each fixed step: a body that touches something loses the angular impulse C_rr m g r dt against its spin, through its own inverse
   * inertia, and never more than stops the spin. Its contact's friction carries the change to its speed, as a rolling body's does.
   */
  private roll(dt: number): void {
    for (const [key, rolling] of this.rollers) {
      const e = this.bodies.get(key)
      if (!e || e.invMass === 0 || !e.body.IsActive() || !this.touching(key as BodyId)) continue
      const w = e.body.GetAngularVelocity()
      const wx = w.GetX(), wy = w.GetY(), wz = w.GetZ()
      const spin = Math.hypot(wx, wy, wz)
      if (spin < 1e-6) continue
      // spin taken away per unit of angular impulse against it: n . I^-1 n
      this.v2.Set(wx / spin, wy / spin, wz / spin)
      const iw = e.body.GetInverseInertia().Multiply3x3(this.v2)
      const per = (iw.GetX() * wx + iw.GetY() * wy + iw.GetZ() * wz) / spin
      if (per <= 0) continue
      const impulse = Math.min((rolling.coefficient * this.gravity * rolling.radius * dt) / e.invMass, spin / per)
      this.v2.Set((-wx / spin) * impulse, (-wy / spin) * impulse, (-wz / spin) * impulse)
      this.bi.AddAngularImpulse(e.id, this.v2)
    }
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

  private recordPoints(key: number, m: JoltNS.ContactManifold, onFirst: boolean): void {
    const p = this.points.get(key)
    if (!p) return
    if (p.step !== this.stepCount) {
      p.step = this.stepCount
      p.n = 0
    }
    const count = m.mRelativeContactPointsOn1.size()
    for (let i = 0; i < count && p.n < POINTS_PER_BODY; i++) {
      const w = onFirst ? m.GetWorldSpaceContactPointOn1(i) : m.GetWorldSpaceContactPointOn2(i)
      p.xyz[p.n * 3] = w.GetX()
      p.xyz[p.n * 3 + 1] = w.GetY()
      p.xyz[p.n * 3 + 2] = w.GetZ()
      p.n++
    }
  }

  touching(id: BodyId): boolean {
    return (this.touches.get(id) ?? 0) > 0
  }

  private pairKey(a: number, b: number): number {
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

  // Contacts ----------------------------------------------------------------------------------------------------------------------------

  /**
   * One JS listener for the whole world. Per new or kept contact: the kit's Coulomb rule (static coefficient while the contact point barely slides,
   * dynamic once it slides faster than `slipSpeed`), and a row in `contacts` for every new contact that closed faster than `reportSpeed`.
   */
  private makeListener(): JoltNS.ContactListenerJS {
    const J = this.J
    const listener = new J.ContactListenerJS()
    const bodyOf = (ptr: number): JoltNS.Body => J.wrapPointer(ptr, J.Body)
    const coulomb = (b1: JoltNS.Body, b2: JoltNS.Body, m: JoltNS.ContactManifold, cs: JoltNS.ContactSettings, report: boolean): void => {
      const e1 = this.bodies.get(b1.GetID().GetIndexAndSequenceNumber())
      const e2 = this.bodies.get(b2.GetID().GetIndexAndSequenceNumber())
      if (!e1 || !e2) return
      if (this.points.size > 0) {
        this.recordPoints(e1.body.GetID().GetIndexAndSequenceNumber(), m, true)
        this.recordPoints(e2.body.GetID().GetIndexAndSequenceNumber(), m, false)
      }
      if (cs.mIsSensor) {
        if (report) this.sensorEvents.push(e1.layer === 'sensor' ? { sensor: e1.body.GetID().GetIndexAndSequenceNumber() as BodyId, other: e2.body.GetID().GetIndexAndSequenceNumber() as BodyId, entered: true } : { sensor: e2.body.GetID().GetIndexAndSequenceNumber() as BodyId, other: e1.body.GetID().GetIndexAndSequenceNumber() as BodyId, entered: true })
        return
      }
      const n = m.mWorldSpaceNormal
      const nx = n.GetX()
      const ny = n.GetY()
      const nz = n.GetZ()
      // the relative velocity of the first contact point, body 1 minus body 2 (the normal points from 1 to 2)
      const p = m.GetWorldSpaceContactPointOn1(0)
      const px = p.GetX()
      const py = p.GetY()
      const pz = p.GetZ()
      let rvx = 0
      let rvy = 0
      let rvz = 0
      for (const [body, sign] of [[b1, 1], [b2, -1]] as const) {
        if (body.IsStatic()) continue
        const v = body.GetLinearVelocity()
        const w = body.GetAngularVelocity()
        const c = body.GetCenterOfMassPosition()
        const rx = px - c.GetX()
        const ry = py - c.GetY()
        const rz = pz - c.GetZ()
        rvx += sign * (v.GetX() + w.GetY() * rz - w.GetZ() * ry)
        rvy += sign * (v.GetY() + w.GetZ() * rx - w.GetX() * rz)
        rvz += sign * (v.GetZ() + w.GetX() * ry - w.GetY() * rx)
      }
      const along = rvx * nx + rvy * ny + rvz * nz
      const tx = rvx - along * nx
      const ty = rvy - along * ny
      const tz = rvz - along * nz
      const slip = Math.hypot(tx, ty, tz)
      const sliding = slip > this.slipSpeed
      // restitution mixed as the kit always has (geometric mean); Jolt's default takes the larger
      cs.mCombinedRestitution = Math.sqrt(e1.material.restitution * e2.material.restitution)
      cs.mCombinedFriction = sliding
        ? mixFriction(e1.material.frictionDynamic, e2.material.frictionDynamic)
        : mixFriction(e1.material.frictionStatic, e2.material.frictionStatic)
      if (!report || along < this.reportSpeed || this.contacts.count >= this.maxContacts) return
      const c = this.contacts
      const i = c.count++
      c.a[i] = e1.body.GetID().GetIndexAndSequenceNumber()
      c.b[i] = e2.body.GetID().GetIndexAndSequenceNumber()
      c.userA[i] = e1.user
      c.userB[i] = e2.user
      c.tagA[i] = e1.body.GetShape().GetSubShapeUserData(m.mSubShapeID1)
      c.tagB[i] = e2.body.GetShape().GetSubShapeUserData(m.mSubShapeID2)
      c.point[i * 3] = px
      c.point[i * 3 + 1] = py
      c.point[i * 3 + 2] = pz
      c.normal[i * 3] = nx
      c.normal[i * 3 + 1] = ny
      c.normal[i * 3 + 2] = nz
      c.approach[i] = along
      // the impulse that stops the closing speed along the normal, by the two masses (rotation ignored): what our damage reads as the blow
      const invMass = e1.invMass + e2.invMass
      c.impulse[i] = invMass > 0 ? ((1 + cs.mCombinedRestitution) * along) / invMass : 0
    }
    listener.OnContactValidate = (body1: number, body2: number) => {
      if (this.ignored.size === 0) return J.ValidateResult_AcceptAllContactsForThisBodyPair
      const k = this.pairKey(bodyOf(body1).GetID().GetIndexAndSequenceNumber(), bodyOf(body2).GetID().GetIndexAndSequenceNumber())
      return this.ignored.has(k) ? J.ValidateResult_RejectAllContactsForThisBodyPair : J.ValidateResult_AcceptAllContactsForThisBodyPair
    }
    const touch = (key: number, by: number): void => {
      const n = (this.touches.get(key) ?? 0) + by
      if (n > 0) this.touches.set(key, n)
      else this.touches.delete(key)
    }
    listener.OnContactAdded = (body1: number, body2: number, manifold: number, settings: number) => {
      touch(bodyOf(body1).GetID().GetIndexAndSequenceNumber(), 1)
      touch(bodyOf(body2).GetID().GetIndexAndSequenceNumber(), 1)
      coulomb(bodyOf(body1), bodyOf(body2), J.wrapPointer(manifold, J.ContactManifold), J.wrapPointer(settings, J.ContactSettings), true)
    }
    listener.OnContactPersisted = (body1: number, body2: number, manifold: number, settings: number) => {
      coulomb(bodyOf(body1), bodyOf(body2), J.wrapPointer(manifold, J.ContactManifold), J.wrapPointer(settings, J.ContactSettings), false)
    }
    listener.OnContactRemoved = (pair: number) => {
      const p = J.wrapPointer(pair, J.SubShapeIDPair)
      const k1 = p.GetBody1ID().GetIndexAndSequenceNumber()
      const k2 = p.GetBody2ID().GetIndexAndSequenceNumber()
      touch(k1, -1)
      touch(k2, -1)
      const e1 = this.bodies.get(k1)
      const e2 = this.bodies.get(k2)
      if (e1?.layer === 'sensor') this.sensorEvents.push({ sensor: k1 as BodyId, other: k2 as BodyId, entered: false })
      else if (e2?.layer === 'sensor') this.sensorEvents.push({ sensor: k2 as BodyId, other: k1 as BodyId, entered: false })
    }
    return listener
  }

  // Joints ------------------------------------------------------------------------------------------------------------------------------

  createGroup(subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number {
    const table = new this.J.GroupFilterTable(subCount)
    for (const [a, b] of disabledPairs) table.DisableCollision(a, b)
    // the bodies hold references to the filter; the world keeps one for itself
    table.AddRef()
    this.groups.push(table)
    return this.groups.length - 1
  }

  createJoint(desc: JointDesc): JointId {
    const J = this.J
    const a = this.entry(desc.a).body
    const b = this.entry(desc.b).body
    let settings: JoltNS.TwoBodyConstraintSettings
    if (desc.kind === 'hinge' || desc.kind === 'fixed') {
      // a fixed joint that can break is a hinge locked at 0: Jolt exposes the hinge's impulses, not the fixed one's
      const axis = desc.kind === 'hinge' ? desc.axis : ([0, 1, 0] as Vec3)
      const normal = desc.kind === 'hinge' ? desc.normal : ([1, 0, 0] as Vec3)
      const s = new J.HingeConstraintSettings()
      s.mPoint1.Set(desc.point[0], desc.point[1], desc.point[2])
      s.mPoint2.Set(desc.point[0], desc.point[1], desc.point[2])
      s.mHingeAxis1.Set(axis[0], axis[1], axis[2])
      s.mHingeAxis2.Set(axis[0], axis[1], axis[2])
      s.mNormalAxis1.Set(normal[0], normal[1], normal[2])
      s.mNormalAxis2.Set(normal[0], normal[1], normal[2])
      s.mLimitsMin = desc.kind === 'hinge' ? desc.min : 0
      s.mLimitsMax = desc.kind === 'hinge' ? desc.max : 0
      if (desc.kind === 'hinge' && desc.friction !== undefined) s.mMaxFrictionTorque = desc.friction
      settings = s
    } else {
      const s = new J.SwingTwistConstraintSettings()
      s.mPosition1.Set(desc.point[0], desc.point[1], desc.point[2])
      s.mPosition2.Set(desc.point[0], desc.point[1], desc.point[2])
      s.mTwistAxis1.Set(desc.twistAxis[0], desc.twistAxis[1], desc.twistAxis[2])
      s.mTwistAxis2.Set(desc.twistAxis[0], desc.twistAxis[1], desc.twistAxis[2])
      s.mPlaneAxis1.Set(desc.planeAxis[0], desc.planeAxis[1], desc.planeAxis[2])
      s.mPlaneAxis2.Set(desc.planeAxis[0], desc.planeAxis[1], desc.planeAxis[2])
      s.mNormalHalfConeAngle = desc.normalHalfCone
      s.mPlaneHalfConeAngle = desc.planeHalfCone
      s.mTwistMinAngle = desc.twistMin
      s.mTwistMaxAngle = desc.twistMax
      if (desc.friction !== undefined) s.mMaxFrictionTorque = desc.friction
      settings = s
    }
    const constraint = J.castObject(settings.Create(a, b), J.TwoBodyConstraint)
    J.destroy(settings)
    this.system.AddConstraint(constraint)
    const id = this.nextJoint++ as JointId
    this.joints.set(id, {
      constraint,
      kind: desc.kind,
      breakImpulse: desc.breakImpulse ?? Infinity,
      hinge: desc.kind === 'swingTwist' ? null : J.castObject(constraint, J.HingeConstraint),
      swing: desc.kind === 'swingTwist' ? J.castObject(constraint, J.SwingTwistConstraint) : null,
    })
    return id
  }

  removeJoint(id: JointId): void {
    const e = this.joints.get(id)
    if (!e) return
    this.system.RemoveConstraint(e.constraint)
    this.joints.delete(id)
  }

  /** Swing and twist of a swing-twist joint now (radians), for checking limits. */
  jointAngles(id: JointId): { swing: number; twist: number; hinge: number } {
    const e = this.joints.get(id)
    if (!e) return { swing: 0, twist: 0, hinge: 0 }
    if (e.hinge) return { swing: 0, twist: 0, hinge: e.hinge.GetCurrentAngle() }
    const q = e.swing?.GetRotationInConstraintSpace()
    if (!q) return { swing: 0, twist: 0, hinge: 0 }
    const x = q.GetX()
    const w = q.GetW()
    // twist about the constraint's x (the twist axis); swing is the rest
    const twist = 2 * Math.atan2(x, w)
    const swing = 2 * Math.acos(Math.min(1, Math.hypot(x, w)))
    return { swing, twist, hinge: 0 }
  }

  private breakJoints(dt: number): void {
    this.brokenJoints.length = 0
    for (const [id, e] of this.joints) {
      if (e.breakImpulse === Infinity) continue
      let impulse = 0
      if (e.hinge) {
        const l = e.hinge.GetTotalLambdaPosition()
        impulse = Math.hypot(l.GetX(), l.GetY(), l.GetZ())
      } else if (e.swing) {
        const l = e.swing.GetTotalLambdaPosition()
        impulse = Math.hypot(l.GetX(), l.GetY(), l.GetZ())
      }
      if (impulse > e.breakImpulse * (dt / this.fixedStep)) {
        this.system.RemoveConstraint(e.constraint)
        this.joints.delete(id)
        this.brokenJoints.push(id as JointId)
      }
    }
  }

  // Vehicles ----------------------------------------------------------------------------------------------------------------------------

  createVehicle(desc: VehicleDesc): VehicleId {
    const J = this.J
    const body = this.createBody({ ...desc.chassis, layer: 'vehicle', allowSleep: true })
    const vs = new J.VehicleConstraintSettings()
    vs.mUp.Set(0, 1, 0)
    vs.mForward.Set(0, 0, 1)
    vs.mMaxPitchRollAngle = Math.PI
    vs.mWheels.clear()
    const controller = new J.WheeledVehicleControllerSettings()
    controller.mEngine.mMaxTorque = desc.maxTorque
    controller.mEngine.mMinRPM = desc.minRpm
    controller.mEngine.mMaxRPM = desc.maxRpm
    controller.mTransmission.mGearRatios.clear()
    for (const g of desc.gears) controller.mTransmission.mGearRatios.push_back(g)
    controller.mTransmission.mReverseGearRatios.clear()
    for (const g of desc.reverseGears) controller.mTransmission.mReverseGearRatios.push_back(g)
    desc.wheels.forEach((w) => {
      const ws = new J.WheelSettingsWV()
      ws.mPosition.Set(w.position[0], w.position[1], w.position[2])
      ws.mSuspensionDirection.Set(0, -1, 0)
      ws.mSteeringAxis.Set(0, 1, 0)
      ws.mWheelUp.Set(0, 1, 0)
      ws.mWheelForward.Set(0, 0, 1)
      ws.mRadius = w.radius
      ws.mWidth = w.width
      ws.mSuspensionMinLength = w.suspensionMin
      ws.mSuspensionMaxLength = w.suspensionMax
      ws.mSuspensionSpring.mFrequency = w.frequency
      ws.mSuspensionSpring.mDamping = w.damping
      ws.mMaxSteerAngle = w.maxSteer
      ws.mMaxBrakeTorque = w.maxBrakeTorque
      ws.mMaxHandBrakeTorque = w.maxHandBrakeTorque
      vs.mWheels.push_back(ws)
    })
    // one differential per driven axle (wheels listed left, right per axle)
    controller.mDifferentials.clear()
    for (let i = 0; i + 1 < desc.wheels.length; i += 2) {
      if (!desc.wheels[i].driven) continue
      const d = new J.VehicleDifferentialSettings()
      d.mLeftWheel = i
      d.mRightWheel = i + 1
      d.mDifferentialRatio = desc.differentialRatio
      controller.mDifferentials.push_back(d)
      J.destroy(d)
    }
    vs.mController = controller
    if (desc.antiRoll) {
      for (let i = 0; i + 1 < desc.wheels.length; i += 2) {
        const bar = new J.VehicleAntiRollBar()
        bar.mLeftWheel = i
        bar.mRightWheel = i + 1
        bar.mStiffness = desc.antiRoll
        vs.mAntiRollBars.push_back(bar)
        J.destroy(bar)
      }
    }
    const e = this.entry(body)
    const constraint = new J.VehicleConstraint(e.body, vs)
    const tester = new J.VehicleCollisionTesterCastCylinder(this.layerOf('vehicle'), 0.05)
    constraint.SetVehicleCollisionTester(tester)
    const wheeled = J.castObject(constraint.GetController(), J.WheeledVehicleController)
    // a car made already moving rolls: its wheels turn with it, or they skid it to a stop
    const v = desc.chassis.linearVelocity
    if (v) {
      desc.wheels.forEach((w, i) => constraint.GetWheel(i).SetAngularVelocity(v[2] / w.radius))
      // and in the gear that speed asks for (the highest one that keeps the engine above its minimum)
      const wheelRpm = (Math.abs(v[2]) / (desc.wheels[0]?.radius ?? 0.3)) * (60 / (2 * Math.PI)) * desc.differentialRatio
      let gear = 1
      desc.gears.forEach((ratio, i) => {
        if (wheelRpm * ratio >= desc.minRpm * 1.5) gear = i + 1
      })
      wheeled.GetTransmission().Set(gear, 1)
    }
    this.system.AddConstraint(constraint)
    const listener = new J.VehicleConstraintStepListener(constraint)
    this.system.AddStepListener(listener)
    J.destroy(vs)
    const id = this.nextVehicle++ as VehicleId
    this.vehicles.set(id, { body, constraint, controller: wheeled, listener, tester })
    return id
  }

  driveVehicle(id: VehicleId, input: VehicleInput): void {
    const v = this.vehicles.get(id)
    if (!v) return
    v.controller.SetDriverInput(input.forward, input.right, input.brake, input.handBrake)
    if (input.forward !== 0 || input.right !== 0) this.bi.ActivateBody(this.entry(v.body).id)
  }

  vehicleBody(id: VehicleId): BodyId {
    const v = this.vehicles.get(id)
    if (!v) throw new Error(`game-physics-jolt: no vehicle ${id}`)
    return v.body
  }

  removeVehicle(id: VehicleId): void {
    const v = this.vehicles.get(id)
    if (!v) return
    this.system.RemoveStepListener(v.listener)
    this.system.RemoveConstraint(v.constraint)
    this.J.destroy(v.listener)
    this.removeBody(v.body)
    this.vehicles.delete(id)
  }

  wheelContacts(id: VehicleId): number {
    const v = this.vehicles.get(id)
    if (!v) return 0
    let n = 0
    for (let i = 0; i < 4; i++) if (v.constraint.GetWheel(i).HasContact()) n++
    return n
  }

  /**
   * A walking capsule (Jolt's `CharacterVirtual`, spike: not yet in the contract): not a body, it moves by sweeps against the world, steps up stairs and sticks
   * to the floor going down (`ExtendedUpdate`), and pushes dynamic bodies with up to `strength` N. `update` takes the wanted horizontal speed; gravity is its own.
   */
  createCharacter(at: Vec3, radius: number, halfHeight: number, mass: number, strength: number): JoltCharacter {
    const J = this.J
    const settings = new J.CharacterVirtualSettings()
    const shape = this.makeShape({ kind: 'capsule', halfHeight, radius })
    settings.mShape = shape
    settings.mMass = mass
    settings.mMaxStrength = strength
    settings.mMaxSlopeAngle = (45 * Math.PI) / 180
    // the capsule's foot at the position
    settings.mShapeOffset.Set(0, halfHeight + radius, 0)
    this.r1.Set(at[0], at[1], at[2])
    this.q1.Set(0, 0, 0, 1)
    const character = new J.CharacterVirtual(settings, this.r1, this.q1, this.system)
    J.destroy(settings)
    shape.Release()
    const update = new J.ExtendedUpdateSettings()
    update.mWalkStairsStepUp.Set(0, 0.4, 0)
    update.mStickToFloorStepDown.Set(0, -0.5, 0)
    const velocity = new J.Vec3(0, 0, 0)
    const gravity = new J.Vec3(0, -9.81, 0)
    let fall = 0
    return {
      update: (dt: number, vx: number, vz: number) => {
        fall = character.IsSupported() ? 0 : fall - 9.81 * dt
        velocity.Set(vx, fall, vz)
        character.SetLinearVelocity(velocity)
        character.ExtendedUpdate(dt, gravity, update, this.bpFilter, this.objFilter, this.bodyFilter, this.shapeFilter, this.iface.GetTempAllocator())
      },
      position: (out: Float64Array) => {
        const p = character.GetPosition()
        out[0] = p.GetX()
        out[1] = p.GetY()
        out[2] = p.GetZ()
      },
      supported: () => character.IsSupported(),
      dispose: () => {
        J.destroy(update)
        J.destroy(velocity)
        J.destroy(gravity)
        J.destroy(character)
      },
    }
  }

  // Queries -----------------------------------------------------------------------------------------------------------------------------

  private filterFor(filter?: QueryFilter): JoltNS.ObjectLayerFilter {
    if (!filter?.layers) return this.objFilter
    const key = [...filter.layers].sort().join(',')
    let f = this.layerFilters.get(key)
    if (!f) {
      const allowed = new Set(filter.layers.map((l) => this.layerOf(l)))
      f = new this.J.ObjectLayerFilterJS()
      f.ShouldCollide = (layer: number) => allowed.has(layer)
      this.layerFilters.set(key, f)
    }
    return f
  }

  private hit(bodyKey: number, sub: JoltNS.SubShapeID, distance: number): RayHit {
    const e = this.bodies.get(bodyKey)
    const tag = e ? e.body.GetShape().GetSubShapeUserData(sub) : -1
    return { body: bodyKey as BodyId, user: e?.user ?? -1, tag, distance }
  }

  rayAll(from: Vec3, direction: Vec3, length: number, out: RayHit[], filter?: QueryFilter): number {
    this.ray.mOrigin.Set(from[0], from[1], from[2])
    this.ray.mDirection.Set(direction[0] * length, direction[1] * length, direction[2] * length)
    const c = this.rayCollector
    c.Reset()
    this.system.GetNarrowPhaseQuery().CastRay(this.ray, this.raySettings, c, this.bpFilter, this.filterFor(filter), this.bodyFilter, this.shapeFilter)
    c.Sort()
    out.length = 0
    const hits = c.mHits
    for (let i = 0; i < hits.size(); i++) {
      const h = hits.at(i)
      out.push(this.hit(h.mBodyID.GetIndexAndSequenceNumber(), h.mSubShapeID2, h.mFraction * length))
    }
    return out.length
  }

  rayFirst(from: Vec3, direction: Vec3, length: number, filter?: QueryFilter): RayHit | null {
    this.ray.mOrigin.Set(from[0], from[1], from[2])
    this.ray.mDirection.Set(direction[0] * length, direction[1] * length, direction[2] * length)
    const c = this.rayClosest
    c.Reset()
    this.system.GetNarrowPhaseQuery().CastRay(this.ray, this.raySettings, c, this.bpFilter, this.filterFor(filter), this.bodyFilter, this.shapeFilter)
    if (!c.HadHit()) return null
    return this.hit(c.mHit.mBodyID.GetIndexAndSequenceNumber(), c.mHit.mSubShapeID2, c.mHit.mFraction * length)
  }

  private sphere(radius: number): JoltNS.Shape {
    const key = Math.round(radius * 1000)
    let s = this.sphereShapes.get(key)
    if (!s) {
      s = this.makeShape({ kind: 'sphere', radius: key / 1000 })
      this.sphereShapes.set(key, s)
    }
    return s
  }

  overlapSphere(center: Vec3, radius: number, out: BodyId[], filter?: QueryFilter): number {
    const J = this.J
    const shape = this.sphere(radius)
    this.r1.Set(center[0], center[1], center[2])
    const m = J.RMat44.prototype.sTranslation(this.r1)
    this.v2.Set(1, 1, 1)
    const c = this.collideCollector
    c.Reset()
    this.r1.Set(0, 0, 0)
    this.system.GetNarrowPhaseQuery().CollideShape(shape, this.v2, m, this.collideSettings, this.r1, c, this.bpFilter, this.filterFor(filter), this.bodyFilter, this.shapeFilter)
    out.length = 0
    const hits = c.mHits
    const seen = new Set<number>()
    for (let i = 0; i < hits.size(); i++) {
      const k = hits.at(i).mBodyID2.GetIndexAndSequenceNumber()
      if (!seen.has(k)) {
        seen.add(k)
        out.push(k as BodyId)
      }
    }
    return out.length
  }

  sphereCastAll(from: Vec3, direction: Vec3, length: number, radius: number, out: RayHit[], filter?: QueryFilter): number {
    const J = this.J
    const shape = this.sphere(radius)
    this.r1.Set(from[0], from[1], from[2])
    const m = J.RMat44.prototype.sTranslation(this.r1)
    this.v1.Set(direction[0] * length, direction[1] * length, direction[2] * length)
    this.v2.Set(1, 1, 1)
    const cast = new J.RShapeCast(shape, this.v2, m, this.v1)
    const c = this.castCollector
    c.Reset()
    this.r1.Set(0, 0, 0)
    this.system.GetNarrowPhaseQuery().CastShape(cast, this.castSettings, this.r1, c, this.bpFilter, this.filterFor(filter), this.bodyFilter, this.shapeFilter)
    J.destroy(cast)
    c.Sort()
    out.length = 0
    const hits = c.mHits
    for (let i = 0; i < hits.size(); i++) {
      const h = hits.at(i)
      out.push(this.hit(h.mBodyID2.GetIndexAndSequenceNumber(), h.mSubShapeID2, h.mFraction * length))
    }
    return out.length
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
      if (this.rollers.size > 0) this.roll(this.fixedStep)
      this.breakJoints(this.fixedStep)
      steps++
    }
    if (steps === 0) this.brokenJoints.length = 0
  }

  /** Exact state of every body (positions, velocities, sleep, contact cache), for save/load and determinism checks. */
  saveState(): Uint8Array {
    const J = this.J
    const chunks: Uint8Array[] = []
    const rec = new J.StateRecorderJS()
    rec.WriteBytes = (data: number, size: number) => {
      chunks.push(J.HEAPU8.slice(data, data + size))
    }
    rec.ReadBytes = () => undefined
    rec.IsEOF = () => false
    rec.IsFailed = () => false
    this.system.SaveState(rec)
    J.destroy(rec)
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let at = 0
    for (const c of chunks) {
      out.set(c, at)
      at += c.length
    }
    return out
  }

  restoreState(data: Uint8Array): boolean {
    const J = this.J
    let at = 0
    let failed = false
    const rec = new J.StateRecorderJS()
    rec.ReadBytes = (out: number, size: number) => {
      if (at + size > data.length) {
        failed = true
        return
      }
      J.HEAPU8.set(data.subarray(at, at + size), out)
      at += size
    }
    rec.WriteBytes = () => undefined
    rec.IsEOF = () => at >= data.length
    rec.IsFailed = () => failed
    const ok = this.system.RestoreState(rec)
    J.destroy(rec)
    return ok && !failed
  }

  memoryInUse(): number {
    return this.iface.sGetTotalMemory() - this.iface.sGetFreeMemory()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const J = this.J
    for (const id of [...this.vehicles.keys()]) this.removeVehicle(id as VehicleId)
    for (const id of [...this.joints.keys()]) this.removeJoint(id as JointId)
    for (const id of [...this.bodies.keys()]) this.removeBody(id as BodyId)
    for (const s of this.sphereShapes.values()) s.Release()
    for (const g of this.groups) g.Release()
    for (const f of this.layerFilters.values()) J.destroy(f)
    for (const o of [this.v1, this.v2, this.r1, this.q1, this.ray, this.raySettings, this.rayCollector, this.rayClosest, this.bpFilter, this.objFilter, this.bodyFilter, this.shapeFilter, this.collideSettings, this.collideCollector, this.castSettings, this.castCollector]) J.destroy(o)
    J.destroy(this.iface)
    J.destroy(this.listener)
  }
}
