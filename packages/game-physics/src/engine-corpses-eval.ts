import { farthestSleeping, rungBelow } from './body-lod'
import type { BodyLodDecision, BodyLodInput } from './body-lod'
import type { BodyId, Vec3 } from './contract'
import { freezeCorpses } from './engine-corpses-pile'
import { advanceTravel, ARRIVED, collectArrived, compactHeap, marginOf, wakeThoseWoken } from './engine-corpses-dormant'
import { anchorBody, readTouching, rigidBodies, switchRung, switchUnits } from './engine-corpses-swap'
import type { CorpseContext, CorpseRecord, PendingChange, SettledCorpse } from './engine-corpses-types'
import { capsuleOfTorso, rotateVector, standingTorso } from './corpse-pose'
import type { CorpseBodyKit, Rigid } from './corpse-pose'

/** How far (m) above another body's centre a body is to count as resting on it. */
const ABOVE = 0.1

export const distanceTo = (interest: readonly Vec3[], x: number, z: number): number => {
  let nearest = interest.length === 0 ? 0 : Infinity
  for (const point of interest) nearest = Math.min(nearest, Math.hypot(point[0] - x, point[2] - z))
  return nearest
}

const countCorpses = (ctx: CorpseContext, record: CorpseRecord): number => {
  const seen = new Set<number>()
  for (const body of record.touching) {
    const owner = ctx.ownerOf.get(body)
    if (owner !== undefined && owner !== record.id) seen.add(owner)
    else if (ctx.pileOf.has(body)) seen.add(-(ctx.pileOf.get(body) as number))
  }
  return seen.size
}

const hasBodyAbove = (ctx: CorpseContext, record: CorpseRecord): boolean => {
  for (const body of record.touching) {
    const owner = ctx.ownerOf.get(body)
    const other = owner === undefined ? undefined : ctx.records.get(owner)
    if (other && (other.torso[1] as number) > (record.torso[1] as number) + ABOVE) return true
  }
  return false
}

const inPileNow = (ctx: CorpseContext, record: CorpseRecord, moundAt: ((x: number, z: number) => number) | undefined): boolean =>
  countCorpses(ctx, record) >= ctx.lod.numbers.pileContacts || (moundAt?.(record.torso[0] as number, record.torso[2] as number) ?? 0) > ctx.lod.numbers.pileHeight

/** Each pile's bodies in order of distance (the lowest id among equals): `pileRank`, which the policy reads to keep only the nearest chains. Seen every `evaluateEvery` steps. */
export const rankPiles = (ctx: CorpseContext, moundAt: ((x: number, z: number) => number) | undefined): void => {
  if (ctx.lod.numbers.pileChainsMax === Infinity) return
  let any = false
  for (const record of ctx.records.values()) {
    record.pileRank = 0
    if (record.bodies.length > 0 && record.rung !== 'r0' && inPileNow(ctx, record, moundAt)) any = true
  }
  if (!any) return
  for (const island of islands(ctx)) {
    const members = island.filter((record) => record.rung !== 'r0' && inPileNow(ctx, record, moundAt))
    members.sort((a, b) => a.distance - b.distance || a.id - b.id)
    members.forEach((record, rank) => {
      record.pileRank = rank
    })
  }
}

/** How far (m) beyond a standing body's own capsule a death looks for the corpses it falls on. */
const BIRTH_REACH = 0.25
/** How far (m) around a death the chains of its pile are counted: bodies that have just fallen have no contact lists yet to join them into an island. */
const PILE_REACH = 4
const FOUND: BodyId[] = []

/**
 * Whether a death at `frame` falls on a pile that already keeps `pileChainsMax` chains: the same pile test as the policy (it reaches `pileContacts` dead bodies, or one of them
 * on a mound higher than `pileHeight`), and the R1 within `PILE_REACH` of it are already that many. Such a body is born a capsule, without passing through R1.
 */
export const bornInFullPile = (ctx: CorpseContext, kit: CorpseBodyKit, frame: Rigid, moundAt: ((x: number, z: number) => number) | undefined): boolean => {
  const { pileChainsMax, pileContacts, pileHeight } = ctx.lod.numbers
  if (pileChainsMax === Infinity) return false
  const capsule = capsuleOfTorso(kit, standingTorso(kit, frame))
  const shape = kit.capsule.shape
  const probe = shape.kind === 'capsule' ? { ...shape, radius: shape.radius + BIRTH_REACH } : shape
  ctx.world.overlapShape(probe, capsule.position, capsule.rotation, FOUND, { layers: ['corpse'] })
  const owners = new Set<number>()
  for (const body of FOUND) {
    const owner = ctx.ownerOf.get(body)
    if (owner !== undefined) owners.add(owner)
  }
  const onMound = (moundAt?.(frame.position[0], frame.position[2]) ?? 0) > pileHeight
  if (owners.size === 0 || (owners.size < pileContacts && !onMound)) return false
  let chains = 0
  for (const record of ctx.records.values()) {
    if (record.rung === 'r1' && Math.hypot((record.torso[0] as number) - frame.position[0], (record.torso[2] as number) - frame.position[2]) <= PILE_REACH) chains++
  }
  return chains >= pileChainsMax
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** What the policy is asked about one corpse: read from the engine when it has bodies (and kept while it sleeps), else from what was kept. */
const inputOf = (ctx: CorpseContext, record: CorpseRecord, moundAt: ((x: number, z: number) => number) | undefined, into: Mutable<BodyLodInput>): BodyLodInput => {
  into.rung = record.rung
  into.distance = record.distance
  into.asleepSeconds = record.asleepSeconds
  into.sinceChangeSeconds = record.sinceChangeSeconds
  into.touchingCorpses = countCorpses(ctx, record)
  into.moundHeight = moundAt?.(record.torso[0] as number, record.torso[2] as number) ?? 0
  into.hasBodyAbove = hasBodyAbove(ctx, record)
  into.pileRank = record.pileRank
  into.woken = record.woken
  return into
}

/** Looks at one corpse: sleep, contacts and distance, as the policy needs them. Awake bodies are read each time; a sleeper is read once, as it falls asleep. */
const look = (ctx: CorpseContext, record: CorpseRecord, step: EvaluateOptions): void => {
  ctx.looks++
  const elapsed = (ctx.tick - record.lastLookedAt) * step.h
  record.lastLookedAt = ctx.tick
  record.sinceChangeSeconds += elapsed
  if (record.bodies.length > 0) {
    const body = anchorBody(record)
    const asleep = ctx.world.isSleeping(body)
    if (asleep) record.asleepSeconds += elapsed
    else {
      record.asleepSeconds = 0
      if (record.rung === 'r2') record.woken = true
    }
    if (!(asleep && record.asleep) || record.stale) {
      ctx.world.readPose(body, POSE, 0)
      record.torso[0] = POSE[0] as number
      record.torso[1] = POSE[1] as number
      record.torso[2] = POSE[2] as number
      record.touching = readTouching(ctx, record)
      record.stale = false
      if (asleep) tellSettled(record, step)
    }
    record.asleep = asleep
  }
  record.distance = distanceTo(step.interest, record.torso[0] as number, record.torso[2] as number)
}

const POSE = new Float64Array(7)
const HEAD_UP: Vec3 = [0, 1, 0]

/** A corpse that has just fallen asleep far from where the host has it: the host is told where it lies (once; the new place is the one it has from then on). */
const tellSettled = (record: CorpseRecord, step: EvaluateOptions): void => {
  if (!step.onSettled || Math.hypot((POSE[0] as number) - record.originX, (POSE[2] as number) - record.originZ) <= step.settleDistance) return
  const head = rotateVector([POSE[3] as number, POSE[4] as number, POSE[5] as number, POSE[6] as number], HEAD_UP)
  record.originX = POSE[0] as number
  record.originZ = POSE[2] as number
  step.onSettled({ id: record.id, x: record.originX, z: record.originZ, yaw: Math.atan2(-head[0], -head[2]) } satisfies SettledCorpse)
}

export interface EvaluateOptions {
  readonly h: number
  readonly onSettled: ((corpse: SettledCorpse) => void) | undefined
  readonly settleDistance: number
  readonly interest: readonly Vec3[]
  readonly every: number
  readonly moundAt: ((x: number, z: number) => number) | undefined
}

const due = (ctx: CorpseContext, record: CorpseRecord, every: number): boolean => record.rung === 'r0' || (ctx.tick + record.id) % every === 0

const INPUT = { rung: 'r1', distance: 0, asleepSeconds: 0, sinceChangeSeconds: 0, touchingCorpses: 0, moundHeight: 0, hasBodyAbove: false, pileRank: 0, woken: false } as Mutable<BodyLodInput>
const DECISION: BodyLodDecision = { to: 'r1', forced: false }

/** Looks at one corpse and asks the policy; a corpse that stays and has nothing that could change it leaves the list the step walks. */
const visit = (ctx: CorpseContext, record: CorpseRecord, options: EvaluateOptions): void => {
  look(ctx, record, options)
  ctx.lod.decide(inputOf(ctx, record, options.moundAt, INPUT), DECISION)
  if (DECISION.to !== record.rung) {
    if (DECISION.to === 'r2f') ctx.freezing.push(record)
    else ctx.pending.push({ record, to: DECISION.to, forced: DECISION.forced })
    return
  }
  const margin = marginOf(ctx, record, INPUT.hasBodyAbove)
  if (margin === undefined) return
  record.dormant = true
  record.dormantKey = ctx.travel + margin
  ctx.live.delete(record)
  if (margin !== Infinity) ctx.dormant.push(record.dormantKey, record)
}

const byBirth = (a: { readonly born: number }, b: { readonly born: number }): number => a.born - b.born

/**
 * One fixed step of the policy. A step walks only the corpses that are not dormant (awake, changing, or with a change by distance in reach) plus those the interest has come near
 * to; a sleeper is not asked each time. The changes then run, the forced ones first, the rest as the frame's units allow.
 */
export const evaluateCorpses = (ctx: CorpseContext, options: EvaluateOptions): void => {
  ctx.pending.length = 0
  ctx.freezing.length = 0
  advanceTravel(ctx, options.interest)
  if (ctx.tick % options.every === 0) {
    wakeThoseWoken(ctx)
    compactHeap(ctx)
  }
  collectArrived(ctx)
  for (const record of ARRIVED) visit(ctx, record, options)
  for (const record of ctx.live) if (record.lastLookedAt !== ctx.tick && due(ctx, record, options.every)) visit(ctx, record, options)
  if (ctx.freezing.length > 0) freezeCorpses(ctx, ctx.freezing.sort(byBirth))
  runChanges(ctx, ctx.pending.sort(byBirth2))
}

const byBirth2 = (a: PendingChange, b: PendingChange): number => a.record.born - b.record.born

const runChanges = (ctx: CorpseContext, pending: readonly PendingChange[]): void => {
  if (pending.length === 0) return
  for (const change of pending.filter((item) => item.forced)) {
    ctx.budget?.take('lod', switchUnits(change.record, change.to))
    switchRung(ctx, change.record, change.to, true)
  }
  for (const change of pending.filter((item) => !item.forced)) {
    if (ctx.budget && !ctx.budget.tryTake('lod', switchUnits(change.record, change.to))) continue
    const fromNothing = change.record.rung === 'r3'
    if (!switchRung(ctx, change.record, change.to, false)) continue
    if (fromNothing) change.record.asleepSeconds = ctx.lod.numbers.sleepSeconds
  }
}

/** The distances a dormant corpse kept are from when it was last looked at: a quota that takes the farthest asks again, from where the interest is now. */
const refreshDistances = (ctx: CorpseContext): void => {
  const interest = ctx.readInterest()
  for (const record of ctx.records.values()) record.distance = distanceTo(interest, record.torso[0] as number, record.torso[2] as number)
}

/** The quotas: ragdolls at most `ragdollsMax`, rigid bodies at most `dynamicBodiesMax`; the farthest sleeper goes down a rung until each fits (or none sleeps). Free when they hold. */
export const enforceQuotas = (ctx: CorpseContext): void => {
  const { ragdollsMax, dynamicBodiesMax } = ctx.lod.numbers
  if (ctx.rungCounts.r0 <= ragdollsMax && ctx.rigidCount <= dynamicBodiesMax) return
  refreshDistances(ctx)
  for (let guard = 0; guard < 64 && ctx.rungCounts.r0 > ragdollsMax; guard++) {
    const victim = farthestSleeping(ctx.records.values(), 'r0')
    if (victim < 0) break
    switchRung(ctx, ctx.records.get(victim) as CorpseRecord, 'r1', true)
  }
  for (let guard = 0; guard < 64 && ctx.rigidCount > dynamicBodiesMax; guard++) {
    const rung = (['r0', 'r1', 'r2'] as const).find((candidate) => farthestSleeping(ctx.records.values(), candidate) >= 0)
    if (!rung) break
    const record = ctx.records.get(farthestSleeping(ctx.records.values(), rung)) as CorpseRecord
    switchRung(ctx, record, rungBelow(rung), true)
  }
}

/** Groups of corpses that touch (each other's `touching` list), for the island quota. */
const islands = (ctx: CorpseContext): CorpseRecord[][] => {
  const seen = new Set<number>()
  const groups: CorpseRecord[][] = []
  for (const start of ctx.records.values()) {
    if (seen.has(start.id) || start.bodies.length === 0) continue
    seen.add(start.id)
    const group: CorpseRecord[] = []
    const queue = [start]
    for (let head = 0; head < queue.length; head++) {
      const here = queue[head] as CorpseRecord
      group.push(here)
      for (const body of here.touching) {
        const owner = ctx.ownerOf.get(body)
        const next = owner === undefined ? undefined : ctx.records.get(owner)
        if (next && next.bodies.length > 0 && !seen.has(next.id)) {
          seen.add(next.id)
          queue.push(next)
        }
      }
    }
    groups.push(group)
  }
  return groups
}

/** The island quota: an island of more than `islandBodiesMax` rigid bodies has its oldest sleepers frozen into its pile, a few at a time. */
export const enforceIslands = (ctx: CorpseContext, perRound = 8): void => {
  const { islandBodiesMax } = ctx.lod.numbers
  if (ctx.rigidCount <= islandBodiesMax) return
  const oldest: CorpseRecord[] = []
  for (const island of islands(ctx)) {
    const bodies = island.reduce((total, record) => total + rigidBodies(record, record.rung), 0)
    if (bodies <= islandBodiesMax) continue
    const sleepers = island.filter((record) => record.rung === 'r1' && record.asleep).sort((a, b) => a.born - b.born)
    oldest.push(...sleepers.slice(0, perRound))
  }
  if (oldest.length > 0) freezeCorpses(ctx, oldest)
}
