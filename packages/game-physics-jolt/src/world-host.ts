import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyDesc, BodyId, JointId, Rolling, SensorEvent, ShapeDesc } from '@adatechnology/game-physics'

import type { Contacts } from './contact-rows'
import type { Jolt } from './constants'
import type { RagdollCache } from './ragdoll-cache'
import type { SlabIndex } from './seam'
import type { BodyEntry, JointEntry, JoltCharacter, RagdollEntry, VehicleEntry, WatchedContacts } from './entries'

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
  /** Shapes held by `createSharedShape`, by id: a body made from one takes its own reference. */
  readonly sharedShapes: Map<number, JoltNS.Shape>
  nextShared: number
  readonly watched: Map<number, WatchedContacts>
  readonly fixedStep: number
  accumulator: number
  readonly slipSpeed: number
  /** The world's sleep speed (m/s) and sleep time (s): what `settleVehicles` holds a vehicle to. */
  readonly sleepSpeed: number
  readonly sleepAfter: number
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
  /** Hands each hit to `onCollide` and keeps none: a ground of thousands of triangles must not become thousands of results in the heap. */
  readonly collideCollector: JoltNS.CollideShapeCollectorJS
  onCollide: (hit: JoltNS.CollideShapeResult) => void
  readonly castSettings: JoltNS.ShapeCastSettings
  readonly castCollector: JoltNS.CastShapeCollectorJS
  onCast: (hit: JoltNS.ShapeCastResult) => void
  /** Scratch sub shape id for reading the tag of a cast hit. */
  readonly subShape: JoltNS.SubShapeID
  readonly sphereShapes: Map<number, JoltNS.Shape>
  /** The capsules `setCharacterShape` and the walkers use, by radius and half height: let go of at `dispose`. */
  readonly characterShapes: Map<string, JoltNS.Shape>
  /** The shapes `overlapShape` asked about, by the description's identity (a kit asks with the same few again and again): held up to a few, let go of at `dispose`. */
  readonly queryShapes: Map<string, JoltNS.Shape>
  /** The shapes and skeletons the ragdolls made by `createRagdoll` share. */
  readonly ragdollCache: RagdollCache
  readonly partners: Map<number, Map<number, number>>
  trackPairs: boolean
  readonly pairLog: number[]
  readonly activeIds: JoltNS.BodyIDVector
  readonly ignored: Set<number>
  /** The flat slabs of the world (`Slab`): the contact listener looks for seam contacts only while there are any. */
  readonly slabs: SlabIndex
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
