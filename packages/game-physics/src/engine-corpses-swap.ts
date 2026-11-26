import type { BodyDesc, BodyId, Layer, Quat, RagdollDesc, ShapeDesc, Vec3 } from './contract'
import { KIT_RAGDOLL_SOLVER } from './contract'
import { capsuleOfTorso, chainOfCapsule, chainOfPoses, multiplyQuat, placeRagdoll, standingTorso, torsoOfCapsule } from './corpse-pose'
import type { Rigid } from './corpse-pose'
import { LOD_UNITS } from './engine-corpses-types'
import type { CorpseContext, CorpseRecord } from './engine-corpses-types'
import type { BodyRung } from './body-lod'

const POSE = new Float64Array(7)
const VELOCITY = new Float64Array(6)
const STANDS_ON: readonly Layer[] = ['static', 'corpse', 'debris', 'prop']
/** How far (m) a new body is lifted to clear what it would be born inside, in steps, at most. */
const LIFT_STEP = 0.005
const LIFT_MAX = 0.05
const FOUND: BodyId[] = []
const NO_SPIN: Vec3 = [0, 0, 0]
const NO_PARTNERS: BodyId[] = []
const PARTNERS: BodyId[] = []
const OWN = new Set<BodyId>()
const FOUND_PARTNERS = new Set<BodyId>()
const IDENTITY: Quat = [0, 0, 0, 1]

export const rigidOf = (ctx: CorpseContext, body: BodyId): Rigid => {
  ctx.world.readPose(body, POSE, 0)
  return { position: [POSE[0] as number, POSE[1] as number, POSE[2] as number], rotation: [POSE[3] as number, POSE[4] as number, POSE[5] as number, POSE[6] as number] }
}

/** The body a corpse is judged by (asleep or not, where it is): the torso of a ragdoll or chain, the capsule. */
export const anchorBody = (record: CorpseRecord): BodyId => (record.rung === 'r0' ? (record.bodies[record.kit.anchors.torso] as BodyId) : (record.bodies[0] as BodyId))

/** Where the chain's torso frame is now, for any rung. */
export const torsoOf = (ctx: CorpseContext, record: CorpseRecord): Rigid => {
  if (record.rung === 'r2f' || record.rung === 'r3') return { position: [record.torso[0] as number, record.torso[1] as number, record.torso[2] as number], rotation: [record.torso[3] as number, record.torso[4] as number, record.torso[5] as number, record.torso[6] as number] }
  const now = rigidOf(ctx, anchorBody(record))
  if (record.rung === 'r2') return torsoOfCapsule(record.kit, now)
  if (record.rung === 'r1') return now
  return chainTorsoOfRagdoll(record, now)
}

/** `torsoOf` written straight into `out` (x y z, then the quaternion) at `offset`: the rungs that hold the torso as it is do not make an object to say so. */
export const writeTorso = (ctx: CorpseContext, record: CorpseRecord, out: Float32Array | Float64Array, offset: number): void => {
  if (record.rung === 'r2f' || record.rung === 'r3') {
    for (let index = 0; index < 7; index++) out[offset + index] = record.torso[index] as number
    return
  }
  if (record.rung === 'r1') {
    ctx.world.readPose(anchorBody(record), out, offset)
    return
  }
  const torso = torsoOf(ctx, record)
  out[offset] = torso.position[0]
  out[offset + 1] = torso.position[1]
  out[offset + 2] = torso.position[2]
  for (let index = 0; index < 4; index++) out[offset + 3 + index] = torso.rotation[index] as number
}

const chainTorsoOfRagdoll = (record: CorpseRecord, ragdollTorso: Rigid): Rigid => {
  const part = record.kit.ragdoll.parts[record.kit.anchors.torso]
  const standing = part?.body.rotation ?? IDENTITY
  const chainStanding = record.kit.chain.parts[0]?.body.rotation ?? IDENTITY
  const turn = multiplyQuat(ragdollTorso.rotation, [-standing[0], -standing[1], -standing[2], standing[3]])
  return { position: ragdollTorso.position, rotation: multiplyQuat(turn, chainStanding) }
}

export const storeTorso = (record: CorpseRecord, torso: Rigid): void => {
  record.torso.set([...torso.position, ...torso.rotation])
}

const remember = (ctx: CorpseContext, record: CorpseRecord, bodies: readonly BodyId[]): void => {
  record.bodies = [...bodies]
  ctx.rigidCount += bodies.length
  for (const body of bodies) ctx.ownerOf.set(body, record.id)
}

/** The only place a corpse's rung changes after it is made: the counts by rung follow it. */
export const setRung = (ctx: CorpseContext, record: CorpseRecord, to: BodyRung): void => {
  ctx.rungCounts[record.rung]--
  ctx.rungCounts[to]++
  record.rung = to
}

/** Back in the list a step walks: something changed (a rung, a pile, a wake), so the next look is its own. */
export const wakeRecord = (ctx: CorpseContext, record: CorpseRecord): void => {
  record.dormant = false
  ctx.live.add(record)
}

/** Takes a rung's bodies out of the world and the maps: a ragdoll or chain leaves as one engine object. */
export const removeRungBodies = (ctx: CorpseContext, record: CorpseRecord): void => {
  for (const body of record.bodies) ctx.ownerOf.delete(body)
  ctx.rigidCount -= record.bodies.length
  if (record.ragdoll !== 0) ctx.world.removeRagdoll(record.ragdoll)
  else if (record.rung === 'r2') ctx.world.removeBody(record.bodies[0] as BodyId)
  record.ragdoll = 0
  record.bodies = []
}

interface Piece {
  readonly shape: ShapeDesc
  readonly position: Vec3
  readonly rotation: Quat
}

/** Whether `pieces` lifted by `lift` are inside nothing but the corpse's own bodies. */
/** How much (m) deeper than the engine's own resting overlap (its slop is 2 mm) something may sit in what is there and still be in no one's way. */
const REST_MARGIN = 0.005

/** A shape smaller by `margin`, to ask what is in the way without counting a body that merely rests where it was (it sinks by the slop). */
const shrunkShapes = new WeakMap<ShapeDesc, ShapeDesc>()

const shrunk = (shape: ShapeDesc, margin: number): ShapeDesc => {
  const made = shrunkShapes.get(shape)
  if (made) return made
  const smaller = shrinkBy(shape, margin)
  shrunkShapes.set(shape, smaller)
  return smaller
}

const shrinkBy = (shape: ShapeDesc, margin: number): ShapeDesc => {
  switch (shape.kind) {
    case 'sphere':
      return { ...shape, radius: Math.max(shape.radius - margin, 0.001) }
    case 'capsule':
    case 'cylinder':
      return { ...shape, radius: Math.max(shape.radius - margin, 0.001) }
    case 'box':
      return { kind: 'box', half: [Math.max(shape.half[0] - margin, 0.001), Math.max(shape.half[1] - margin, 0.001), Math.max(shape.half[2] - margin, 0.001)] }
    default:
      return shape
  }
}

const isFree = (ctx: CorpseContext, pieces: readonly Piece[], lift: number, ignore: readonly BodyId[]): boolean =>
  pieces.every((piece) => ctx.world.overlapShape(shrunk(piece.shape, REST_MARGIN), [piece.position[0], piece.position[1] + lift, piece.position[2]], piece.rotation, FOUND, { layers: STANDS_ON, ignore }) === 0)

/** The least lift, a few millimetres at a time and up to 5 cm, that clears everything but the corpse's own bodies; null when 5 cm is not enough. */
const liftToClear = (ctx: CorpseContext, pieces: readonly Piece[], own: readonly BodyId[], max = LIFT_MAX, step = LIFT_STEP): number | null => {
  for (let lift = 0; lift <= max + 1e-9; lift += step) if (isFree(ctx, pieces, lift, own)) return lift
  return null
}

const lifted = (desc: RagdollDesc, lift: number): RagdollDesc =>
  lift === 0 ? desc : { ...desc, parts: desc.parts.map((part) => ({ ...part, body: { ...part.body, position: [part.body.position[0], part.body.position[1] + lift, part.body.position[2]] as Vec3 } })) }

const unitsOf = (rung: BodyRung, kitParts: number): number => (rung === 'r0' ? LOD_UNITS.ragdoll + kitParts : rung === 'r1' ? LOD_UNITS.chain : rung === 'r2' ? LOD_UNITS.capsule : LOD_UNITS.unload)

/** What a change to `rung` costs in the budget's units. */
export const switchUnits = (record: CorpseRecord, rung: BodyRung): number => unitsOf(rung, record.kit.ragdoll.parts.length)

const rigidBodiesOf = (record: CorpseRecord, rung: BodyRung): number => (rung === 'r0' ? record.kit.ragdoll.parts.length : rung === 'r1' ? record.kit.chain.parts.length : rung === 'r2' ? 1 : 0)
export const rigidBodies = rigidBodiesOf

/** Tags every part with its corpse (a query hit names whose body it is): `id * 32 + part index` for the ragdoll, `id` for the chain, as `capsuleDesc` does. */
const USER_STRIDE = 32
const ownedBy = (desc: RagdollDesc, id: number, rung: BodyRung): RagdollDesc => ({
  ...desc,
  parts: desc.parts.map((part, index) => ({ ...part, body: { ...part.body, user: rung === 'r0' ? id * USER_STRIDE + index : id } })),
})

const engineRagdoll = (desc: RagdollDesc, rung: BodyRung, sleeping: boolean, id: number): RagdollDesc => {
  const owned = ownedBy(desc, id, rung)
  return rung === 'r0' ? { ...owned, stabilize: true, solverSteps: KIT_RAGDOLL_SOLVER, sleeping } : { ...owned, stabilize: true, sleeping }
}

const capsuleDesc = (record: CorpseRecord, capsule: Rigid, sleeping: boolean): BodyDesc => ({
  shape: record.kit.capsule.shape,
  motion: 'dynamic',
  position: capsule.position,
  rotation: capsule.rotation,
  mass: record.kit.capsule.mass,
  layer: 'corpse',
  allowSleep: true,
  sleeping,
  angularDamping: 0.3,
  linearDamping: 0.05,
  material: record.kit.ragdoll.parts[0]?.body.material ?? { frictionStatic: 0.8, frictionDynamic: 0.6, restitution: 0.05 },
  user: record.id,
})

const carry = (ctx: CorpseContext, bodies: readonly BodyId[], from: readonly [Vec3, Vec3][]): void => {
  bodies.forEach((body, index) => {
    const [linear, angular] = from[Math.min(index, from.length - 1)] ?? [NO_SPIN, NO_SPIN]
    ctx.world.setVelocity(body, linear, angular)
  })
}

const velocityOf = (ctx: CorpseContext, body: BodyId): [Vec3, Vec3] => {
  ctx.world.readVelocity(body, VELOCITY, 0)
  return [[VELOCITY[0] as number, VELOCITY[1] as number, VELOCITY[2] as number], [VELOCITY[3] as number, VELOCITY[4] as number, VELOCITY[5] as number]]
}

/** The pieces a new ragdoll's parts are, for the overlap check. */
const piecesOf = (desc: RagdollDesc): Piece[] => desc.parts.map((part) => ({ shape: part.body.shape, position: part.body.position, rotation: part.body.rotation ?? IDENTITY }))

interface Made {
  readonly sleeping: boolean
  readonly velocities: readonly [Vec3, Vec3][]
  readonly desc: RagdollDesc | null
  readonly capsule: Rigid | null
}

/** What the new rung is made of, from the old one's poses; null when a rung has nothing to make (the engine holds nothing in R3). */
const plan = (ctx: CorpseContext, record: CorpseRecord, to: BodyRung): Made => {
  const kit = record.kit
  const from = record.rung
  const sleeping = from === 'r3' ? true : record.asleep
  if (from === 'r0' && to === 'r1') {
    const at = (index: number): Rigid => rigidOf(ctx, record.bodies[index] as BodyId)
    const legs: readonly [Rigid, Rigid] = [at(kit.anchors.legs[0]), at(kit.anchors.legs[1])]
    const velocities: [Vec3, Vec3][] = [velocityOf(ctx, record.bodies[kit.anchors.torso] as BodyId), velocityOf(ctx, record.bodies[kit.anchors.head] as BodyId), velocityOf(ctx, record.bodies[kit.anchors.legs[0]] as BodyId)]
    return { sleeping, velocities, capsule: null, desc: chainOfPoses(kit, { torso: at(kit.anchors.torso), head: at(kit.anchors.head), legs }, sleeping) }
  }
  if (to === 'r3') return { sleeping, velocities: [], desc: null, capsule: null }
  const torso = torsoOf(ctx, record)
  const velocities: [Vec3, Vec3][] = record.bodies.length > 0 ? [velocityOf(ctx, anchorBody(record))] : [[NO_SPIN, NO_SPIN]]
  if (to === 'r2') return { sleeping, velocities, desc: null, capsule: capsuleOfTorso(kit, torso) }
  return { sleeping, velocities, desc: chainOfCapsule(kit, capsuleOfTorso(kit, torso), sleeping), capsule: null }
}

/**
 * Changes a corpse's rung in the fixed step it is called in: the new bodies are made from the old ones' poses and velocities (no jump of pose, the torso where it was), only
 * where nothing is in the way (a lift of up to 5 cm clears it; a change that does not wait for the next step does not mind), and then the old ones go. Returns false when
 * the new rung had no room and the change must wait.
 */
export const switchRung = (ctx: CorpseContext, record: CorpseRecord, to: BodyRung, forced: boolean): boolean => {
  const made = plan(ctx, record, to)
  const pieces = made.desc ? piecesOf(made.desc) : made.capsule ? [{ shape: record.kit.capsule.shape, position: made.capsule.position, rotation: made.capsule.rotation }] : []
  const lift = liftToClear(ctx, pieces, record.bodies)
  if (lift === null && !forced) return false
  const rise = lift ?? 0
  const before = record.rung
  const torsoBefore = torsoOf(ctx, record)
  removeOrKeep(ctx, record, before, to, torsoBefore)
  setRung(ctx, record, to)
  wakeRecord(ctx, record)
  record.sinceChangeSeconds = 0
  record.woken = false
  record.pile = 0
  record.stale = true
  record.touching = []
  record.asleep = made.sleeping
  if (made.desc) {
    const built = ctx.world.createRagdoll(engineRagdoll(lifted(made.desc, rise), to, made.sleeping, record.id))
    record.ragdoll = built.id
    remember(ctx, record, built.bodies)
    if (!made.sleeping) carry(ctx, built.bodies, made.velocities)
  } else if (made.capsule) {
    const at: Rigid = { position: [made.capsule.position[0], made.capsule.position[1] + rise, made.capsule.position[2]], rotation: made.capsule.rotation }
    const body = ctx.world.createBody(capsuleDesc(record, at, made.sleeping))
    remember(ctx, record, [body])
    if (!made.sleeping) carry(ctx, [body], made.velocities)
  }
  return true
}

/** The old rung leaves; the torso is kept for a corpse that will have no body. */
const removeOrKeep = (ctx: CorpseContext, record: CorpseRecord, from: BodyRung, to: BodyRung, torso: Rigid): void => {
  if (to === 'r3') storeTorso(record, torso)
  if (from === 'r3') return
  removeRungBodies(ctx, record)
}

/** How far (m) a death into a full pile is raised to clear the bodies there, in steps: it falls onto the pile from there. */
const BIRTH_LIFT_MAX = 3
const BIRTH_LIFT_STEP = 0.05

/** A death: the ragdoll (R0), chain (R1) or, in a pile that is full, capsule (R2) of the kit made standing where the body stood, falling, with the speed it had. */
export const bornAt = (ctx: CorpseContext, record: CorpseRecord, rung: 'r0' | 'r1' | 'r2', frame: Rigid, velocity: Vec3): void => {
  if (rung === 'r2') {
    const capsule = capsuleOfTorso(record.kit, standingTorso(record.kit, frame))
    const pieces = [{ shape: record.kit.capsule.shape, position: capsule.position, rotation: capsule.rotation }]
    const lift = liftToClear(ctx, pieces, [], BIRTH_LIFT_MAX, BIRTH_LIFT_STEP) ?? BIRTH_LIFT_MAX
    const at: Rigid = { position: [capsule.position[0], capsule.position[1] + lift, capsule.position[2]], rotation: capsule.rotation }
    const body = ctx.world.createBody(capsuleDesc(record, at, false))
    remember(ctx, record, [body])
    carry(ctx, [body], [[velocity, NO_SPIN]])
    return
  }
  const placed = placeRagdoll(rung === 'r0' ? record.kit.ragdoll : record.kit.chain, frame)
  const built = ctx.world.createRagdoll(engineRagdoll(placed, rung, false, record.id))
  record.ragdoll = built.id
  remember(ctx, record, built.bodies)
  carry(ctx, built.bodies, [[velocity, NO_SPIN]])
}

/** The bodies of other things that touch any of the corpse's own (deduplicated, in the order found). */
export const readTouching = (ctx: CorpseContext, record: CorpseRecord): BodyId[] => {
  OWN.clear()
  FOUND_PARTNERS.clear()
  for (const body of record.bodies) OWN.add(body)
  for (const body of record.bodies) {
    ctx.world.contactBodies(body, PARTNERS)
    for (const other of PARTNERS) if (!OWN.has(other)) FOUND_PARTNERS.add(other)
  }
  return FOUND_PARTNERS.size === 0 ? NO_PARTNERS : [...FOUND_PARTNERS]
}
