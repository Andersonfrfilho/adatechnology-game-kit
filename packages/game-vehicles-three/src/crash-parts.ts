import type * as THREE_NS from 'three'
import type { BodyId, PhysicsWorld, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import { CONTACT_READ_STRIDE } from '@adatechnology/game-physics'
import { crashVehicle } from '@adatechnology/game-vehicles'
import type { PartDef, VehicleDestructible } from '@adatechnology/game-vehicles'

import type { VehicleColliders } from './colliders'
import { createChassisHulls } from './crash-parts-chassis'
import type { ChassisSettle } from './crash-parts-chassis'
import { createPartBodies } from './crash-parts-bodies'
import type { PartBody } from './crash-parts-bodies'
import { boxInertia, withoutPart } from './crash-parts-math'
import type { BodyMass } from './crash-parts-math'

type Three = typeof THREE_NS

/** Contact points of the car's body read each step. */
const CONTACT_POINTS = 64
/** Steps the car must be still before its hulls are made again (at 120 Hz, a quarter of a second), and how still (m/s, rad/s). */
const SETTLE_STEPS = 30
const SETTLED_SPEED = 0.05
/** A contact point this near (m) the box round a hull is the part touching. */
const TOUCH_MARGIN = 0.05

export interface CrashPartsOptions {
  readonly THREE: Three
  readonly world: PhysicsWorld
  readonly vehicle: VehicleDestructible
  /** The frame the hulls and the drawn meshes are in (`createVehicleColliders`' frame); its pose is the body's. */
  readonly frame: THREE_NS.Object3D
  /** Made with `hulls: true`, and its plan back (`isHullPending()` false). */
  readonly colliders: VehicleColliders
  /** The kit's numbers for the whole car, in the frame: its mass, centre of mass and moments. */
  readonly mass: BodyMass
  /** A part left the car (the host remakes what depends on it: a wheel, the vehicle's constraint). */
  readonly onPartLost?: (part: PartDef) => void
}

export interface CrashParts {
  /** The chassis compound: make the body from it (dynamic, `mass.mass`, `mass.inertia`, `centreAtOrigin` off) and `bind` it. */
  shape(): ShapeDesc
  bind(chassis: BodyId): void
  /** Once after each step: the contact rows become damage, the parts' drawings follow their bodies, and a car at rest has its hulls made again. */
  step(): void
  /** What the car weighs now. */
  mass(): BodyMass
  partBodies(): ReadonlyMap<string, BodyId>
  /** The kit's numbers each part that came off took with it (its mass, its centre in the frame, its moments). */
  partNumbers(): ReadonlyMap<string, BodyMass>
  stats(): {
    readonly released: number
    readonly pushedOut: number
    /** Times the hulls were looked at again, how many were given to the engine again, held back by the touching rule, and left without a child to go in. */
    readonly settles: number
    readonly remade: number
    readonly held: number
    readonly unplaced: number
    /** Blows the contact rows made (`crashVehicle` calls), the damage events they gave, and the parts whose hull was in those rows. */
    readonly blows: number
    readonly events: number
    readonly hitParts: ReadonlySet<string>
    /** Children left in the chassis compound. */
    readonly children: number
  }
  /** Takes the part bodies out of the world and gives the fling back to the vehicle. The chassis body is the host's. */
  dispose(): void
}

export const createCrashParts = (options: CrashPartsOptions): CrashParts => {
  const { THREE, world, vehicle, frame, colliders } = options
  const parts = vehicle.model.parts
  const partIndexOf = new Map(parts.map((part, index) => [part.id, index]))
  const chassisHulls = createChassisHulls(colliders, partIndexOf)
  const bodies = createPartBodies(THREE, world, frame)
  const pose = new Float64Array(7)
  const speed = new Float64Array(6)
  const touches = new Float32Array(CONTACT_READ_STRIDE * CONTACT_POINTS)
  const strongest = new Map<number, number>()
  let chassis: BodyId | undefined
  let current = options.mass
  let calm = 0
  let cooldown = 0
  let isDirty = false
  let released = 0
  let settles = 0
  let held = 0
  let remade = 0
  let unplaced = 0
  let blows = 0
  let events = 0
  const hitParts = new Set<string>()

  const numbers = new Map<string, BodyMass>()
  const carried = (partIndex: number): PartBody | undefined => bodies.bodies.get(partIndex)

  const takePart = (part: PartDef, partIndex: number, holder: THREE_NS.Object3D): void => {
    const body = carried(partIndex)
    const extent = bodies.extentOf(holder)
    if (body) return bodies.follow(body, holder, extent)
    const hulls = chassisHulls.release(world, chassis!, part.id)
    const solid = hulls.length > 0 ? hulls : [boxPoints(extent.size, extent.centre)]
    bodies.create({ partIndex, mass: part.mass, hulls: solid, extent, holder, chassis: chassis!, chassisMass: current })
    const own: BodyMass = { mass: part.mass, centre: extent.centre, inertia: boxInertia(part.mass, extent.size) }
    numbers.set(part.id, own)
    current = withoutPart(current, own)
    world.setMassProperties(chassis!, { mass: current.mass, inertia: current.inertia, centreOfMass: current.centre })
    released++
    options.onPartLost?.(part)
  }

  const isTouching = (points: Float32Array): boolean => {
    if (!chassis) return false
    const count = world.readContacts(chassis, touches)
    if (count === 0) return false
    world.readPose(chassis, pose, 0)
    let lowX = Infinity, lowY = Infinity, lowZ = Infinity
    let highX = -Infinity, highY = -Infinity, highZ = -Infinity
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i]!, y = points[i + 1]!, z = points[i + 2]!
      if (x < lowX) lowX = x
      if (x > highX) highX = x
      if (y < lowY) lowY = y
      if (y > highY) highY = y
      if (z < lowZ) lowZ = z
      if (z > highZ) highZ = z
    }
    // the contact in the chassis frame: the pose's rotation conjugated, applied to the offset
    const qx = -pose[3]!, qy = -pose[4]!, qz = -pose[5]!, qw = pose[6]!
    for (let c = 0; c < count; c++) {
      const at = c * CONTACT_READ_STRIDE
      const vx = touches[at]! - pose[0]!, vy = touches[at + 1]! - pose[1]!, vz = touches[at + 2]! - pose[2]!
      const tx = 2 * (qy * vz - qz * vy)
      const ty = 2 * (qz * vx - qx * vz)
      const tz = 2 * (qx * vy - qy * vx)
      const x = vx + qw * tx + qy * tz - qz * ty
      const y = vy + qw * ty + qz * tx - qx * tz
      const z = vz + qw * tz + qx * ty - qy * tx
      if (x >= lowX - TOUCH_MARGIN && x <= highX + TOUCH_MARGIN && y >= lowY - TOUCH_MARGIN && y <= highY + TOUCH_MARGIN && z >= lowZ - TOUCH_MARGIN && z <= highZ + TOUCH_MARGIN) return true
    }
    return false
  }

  const feedDamage = (): void => {
    const rows = world.contacts
    strongest.clear()
    for (let i = 0; i < rows.count; i++) {
      const mine = rows.a[i] === chassis ? 0 : rows.b[i] === chassis ? 1 : -1
      if (mine < 0) continue
      const tag = mine === 0 ? rows.tagA[i]! : rows.tagB[i]!
      if (tag < 0 || tag >= parts.length) continue
      const at = strongest.get(tag)
      if (at === undefined || rows.approach[i]! > rows.approach[at]!) strongest.set(tag, i)
    }
    for (const [tag, i] of strongest) {
      const mine = rows.a[i] === chassis
      const other = mine ? rows.b[i]! : rows.a[i]!
      const otherMass = world.has(other as BodyId) ? world.massOf(other as BodyId) : 0
      const sign = mine ? 1 : -1
      const part = parts[tag]!
      const result = crashVehicle(vehicle, {
        point: [rows.point[i * 3]!, rows.point[i * 3 + 1]!, rows.point[i * 3 + 2]!],
        direction: [sign * rows.normal[i * 3]!, sign * rows.normal[i * 3 + 1]!, sign * rows.normal[i * 3 + 2]!],
        speed: rows.approach[i]!, massKg: current.mass, otherMassKg: otherMass > 0 ? otherMass : Infinity, contactWidth: Math.max(0.2, part.box.size[2]), source: part.id,
      })
      blows++
      events += result.events.length
      hitParts.add(part.id)
      if (result.events.length > 0) {
        isDirty = true
        cooldown = 0
      }
    }
  }

  const settle = (): void => {
    world.readVelocity(chassis!, speed, 0)
    const still = Math.hypot(speed[0]!, speed[1]!, speed[2]!) < SETTLED_SPEED && Math.hypot(speed[3]!, speed[4]!, speed[5]!) < SETTLED_SPEED
    calm = still ? calm + 1 : 0
    if (calm < SETTLE_STEPS || !(isDirty || chassisHulls.hasWork())) return
    if (cooldown > 0) {
      cooldown--
      return
    }
    const done: ChassisSettle = chassisHulls.settle(world, chassis!, isTouching)
    settles++
    held += done.held
    remade += done.remade
    unplaced += done.unplaced
    isDirty = done.held > 0 || colliders.isHullPending()
    cooldown = done.held > 0 && !colliders.isHullPending() ? SETTLE_STEPS : 0
  }

  vehicle.setPartSink((part, holder) => {
    const partIndex = partIndexOf.get(part.id)
    if (chassis === undefined || partIndex === undefined) return false
    takePart(part, partIndex, holder)
    return true
  })

  return {
    shape: () => chassisHulls.shape(),
    bind: (body) => {
      chassis = body
      world.watchContacts(body, true)
      world.setMassProperties(body, { mass: current.mass, inertia: current.inertia, centreOfMass: current.centre })
    },
    step: () => {
      if (chassis === undefined) return
      feedDamage()
      bodies.step(chassis)
      settle()
    },
    mass: () => current,
    partNumbers: () => numbers,
    partBodies: () => new Map([...bodies.bodies].map(([index, body]) => [parts[index]!.id, body.id])),
    stats: () => ({ released, pushedOut: bodies.pushedOut(), settles, remade, held, unplaced, blows, events, hitParts, children: chassisHulls.count() }),
    dispose: () => {
      vehicle.setPartSink(null)
      bodies.dispose()
      if (chassis !== undefined && world.has(chassis)) world.watchContacts(chassis, false)
    },
  }
}

const boxPoints = (size: Vec3, centre: Vec3): Float32Array => {
  const out = new Float32Array(24)
  for (let k = 0; k < 8; k++) {
    out[k * 3] = centre[0] + (k & 1 ? size[0] : -size[0]) / 2
    out[k * 3 + 1] = centre[1] + (k & 2 ? size[1] : -size[1]) / 2
    out[k * 3 + 2] = centre[2] + (k & 4 ? size[2] : -size[2]) / 2
  }
  return out
}

export type { BodyMass } from './crash-parts-math'
