import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyDesc, BodyId, JointId, Rolling, SensorEvent, ShapeDesc } from '@adatechnology/game-physics'

import type { Contacts } from './contact-rows'
import type { Jolt } from './constants'
import type { BodyEntry, JointEntry, JoltCharacter, RagdollEntry, VehicleEntry } from './entries'

/** What the files beside `world.ts` need of the world: `JoltWorld` satisfies it, and they import this, so none of them imports `world.ts` back. */
export interface JoltWorldHost {
  readonly contacts: Contacts
  readonly sensorEvents: SensorEvent[]
  readonly brokenJoints: JointId[]
  readonly J: Jolt
  readonly iface: JoltNS.JoltInterface
  readonly system: JoltNS.PhysicsSystem
  readonly bi: JoltNS.BodyInterface
  readonly bodies: Map<number, BodyEntry>
  readonly byPointer: Map<number, BodyEntry>
  readonly joints: Map<number, JointEntry>
  readonly vehicles: Map<number, VehicleEntry>
  readonly ragdolls: Map<number, RagdollEntry>
  readonly characters: Map<number, JoltCharacter>
  nextCharacter: number
  nextRagdoll: number
  readonly groups: Array<JoltNS.GroupFilterTable | undefined>
  /** Indices of `groups` that were released: the next `createGroup` takes one. */
  readonly freeGroups: number[]
  nextJoint: number
  nextVehicle: number
  readonly fixedStep: number
  accumulator: number
  readonly slipSpeed: number
  readonly reportSpeed: number
  readonly maxContacts: number
  readonly listener: JoltNS.ContactListenerJS | null
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
  /** The body filter of a query with `QueryFilter.ignore` (made on first use): cleared and loaded for each query. */
  ignoreFilter: JoltNS.IgnoreMultipleBodiesFilter | null
  readonly shapeFilter: JoltNS.ShapeFilter
  readonly layerFilters: Map<string, JoltNS.ObjectLayerFilterJS>
  /** The body filter of `penetration` with `among` (made on first use), the set it lets through and the queried body it leaves out, both cleared after each query. */
  readonly among: { filter: JoltNS.BodyFilterJS | null; set: ReadonlySet<BodyId>; self: number }
  readonly collideSettings: JoltNS.CollideShapeSettings
  readonly collideCollector: JoltNS.CollideShapeAllHitCollisionCollector
  readonly castSettings: JoltNS.ShapeCastSettings
  readonly castCollector: JoltNS.CastShapeAllHitCollisionCollector
  readonly sphereShapes: Map<number, JoltNS.Shape>
  readonly partners: Map<number, Map<number, number>>
  trackPairs: boolean
  readonly pairLog: number[]
  readonly activeIds: JoltNS.BodyIDVector
  readonly ignored: Set<number>
  addIgnoredKey(key: number): void
  clearIgnored(): void
  readonly points: Map<number, { xyz: Float32Array; n: number; step: number }>
  stepCount: number
  readonly rollers: Map<number, Rolling>
  readonly gravity: number
  makeShape(shape: ShapeDesc, centred?: boolean): JoltNS.Shape
  createBody(desc: BodyDesc): BodyId
  removeBody(id: BodyId): void
  forget(id: number): void
  entry(id: BodyId): BodyEntry
  touching(id: BodyId): boolean
  touch(key: number, other: number, by: number): void
  pairKey(a: number, b: number): number
}
