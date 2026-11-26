import type { Vec3 } from './contract'
import { capsuleOfTorso, rotateVector } from './corpse-pose'
import type { Rigid } from './corpse-pose'
import { readTouching, removeRungBodies, storeTorso, switchRung, torsoOf } from './engine-corpses-swap'
import type { CorpseContext, CorpseRecord, Pile } from './engine-corpses-types'

/** How near (m) two frozen capsules must be for one to count as resting on the other. */
const SUPPORT_GAP = 0.03
/** How far above (m) a capsule's centre must be to rest on another and not beside it. */
const SUPPORT_RISE = 0.05
/** How far (m) round a body that is gone the bodies resting on it are woken. */
const WAKE_MARGIN = 1.5

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const capsuleOf = (record: CorpseRecord): Rigid => capsuleOfTorso(record.kit, { position: [record.torso[0] as number, record.torso[1] as number, record.torso[2] as number], rotation: [record.torso[3] as number, record.torso[4] as number, record.torso[5] as number, record.torso[6] as number] })

const halfLengthOf = (record: CorpseRecord): number => (record.kit.capsule.shape.kind === 'capsule' ? record.kit.capsule.shape.halfHeight : 0)
const radiusOf = (record: CorpseRecord): number => (record.kit.capsule.shape.kind === 'capsule' ? record.kit.capsule.shape.radius : 0)

/** The distance between the axes of two capsules, less their radii (closest points of two segments). */
const gapBetween = (first: CorpseRecord, second: CorpseRecord): number => {
  const a = capsuleOf(first)
  const b = capsuleOf(second)
  const da = rotateVector(a.rotation, [0, halfLengthOf(first), 0])
  const db = rotateVector(b.rotation, [0, halfLengthOf(second), 0])
  const p1 = add(a.position, da, -1)
  const p2 = add(b.position, db, -1)
  const d1 = add(da, da, 1)
  const d2 = add(db, db, 1)
  const r: Vec3 = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]]
  const aa = dot(d1, d1)
  const ee = dot(d2, d2)
  const f = dot(d2, r)
  const c = dot(d1, r)
  const bb = dot(d1, d2)
  const denominator = aa * ee - bb * bb
  const clamp = (x: number): number => Math.min(1, Math.max(0, x))
  let s = denominator > 1e-9 ? clamp((bb * f - c * ee) / denominator) : 0
  let t = (bb * s + f) / ee
  if (t < 0) {
    t = 0
    s = clamp(-c / aa)
  } else if (t > 1) {
    t = 1
    s = clamp((bb - c) / aa)
  }
  const q1 = add(p1, d1, s)
  const q2 = add(p2, d2, t)
  return Math.hypot(q1[0] - q2[0], q1[1] - q2[1], q1[2] - q2[2]) - radiusOf(first) - radiusOf(second)
}

const dropPile = (ctx: CorpseContext, pile: Pile): void => {
  ctx.pileOf.delete(pile.body)
  ctx.world.removeBody(pile.body)
  ctx.piles.delete(pile.id)
}

/** The pile's static compound made again from `members`: one capsule child per member, tagged with the corpse's id. */
const buildCompound = (ctx: CorpseContext, id: number, members: readonly number[]): Pile | null => {
  if (members.length === 0) return null
  const children = members.map((memberId) => {
    const record = ctx.records.get(memberId) as CorpseRecord
    const capsule = capsuleOf(record)
    return { shape: record.kit.capsule.shape, position: capsule.position, rotation: capsule.rotation, tag: memberId }
  })
  const body = ctx.world.createBody({ shape: { kind: 'compound', children }, motion: 'static', position: [0, 0, 0], layer: 'static', user: -id })
  const pile: Pile = { id, body, members: [...members] }
  ctx.piles.set(id, pile)
  ctx.pileOf.set(body, id)
  return pile
}

/** The piles a corpse's touching bodies belong to, and the corpses among them that are asked to freeze with it. */
const component = (ctx: CorpseContext, start: CorpseRecord, among: ReadonlyMap<number, CorpseRecord>): { readonly records: CorpseRecord[]; readonly piles: number[] } => {
  const records: CorpseRecord[] = []
  const piles = new Set<number>()
  const seen = new Set<number>([start.id])
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    const here = queue[head] as CorpseRecord
    records.push(here)
    for (const body of here.touching) {
      const pile = ctx.pileOf.get(body)
      if (pile !== undefined) piles.add(pile)
      const owner = ctx.ownerOf.get(body)
      const next = owner === undefined ? undefined : among.get(owner)
      if (next && !seen.has(next.id)) {
        seen.add(next.id)
        queue.push(next)
      }
    }
  }
  return { records, piles: [...piles].sort((x, y) => x - y) }
}

/**
 * The base of a pile, asleep under another body, leaves the dynamic bodies for the pile's one static compound (R2f): what is on top then rests on a body that cannot be woken,
 * so a new death on the pile does not wake the whole base. Candidates that touch (each other, or a pile already frozen) join one compound, made again in one batch.
 */
export const freezeCorpses = (ctx: CorpseContext, candidates: readonly CorpseRecord[]): void => {
  const among = new Map(candidates.map((record) => [record.id, record]))
  const done = new Set<number>()
  // the contacts a sleeper kept are those of when it fell asleep: a pile made since is found by reading them again
  for (const record of candidates) record.touching = readTouching(ctx, record)
  for (const start of candidates) {
    if (done.has(start.id)) continue
    const { records, piles } = component(ctx, start, among)
    for (const record of records) {
      done.add(record.id)
      storeTorso(record, torsoOf(ctx, record))
    }
    const kept = piles.map((id) => ctx.piles.get(id)).filter((pile): pile is Pile => pile !== undefined)
    const members = [...kept.flatMap((pile) => pile.members), ...records.map((record) => record.id)]
    const id = kept[0]?.id ?? ctx.nextPile++
    for (const pile of kept) dropPile(ctx, pile)
    for (const record of records) removeRungBodies(ctx, record)
    const pile = buildCompound(ctx, id, members)
    for (const record of records) {
      record.rung = 'r2f'
      record.pile = id
      record.sinceChangeSeconds = 0
      record.touching = []
      record.stale = true
    }
    for (const memberId of members) (ctx.records.get(memberId) as CorpseRecord).pile = pile?.id ?? 0
  }
}

/** The members that rest on `gone`, and on those, and so on (all of them lose what holds them up). */
const restingOn = (ctx: CorpseContext, pile: Pile, gone: CorpseRecord): CorpseRecord[] => {
  const falling: CorpseRecord[] = []
  const queue = [gone]
  const seen = new Set<number>([gone.id])
  for (let head = 0; head < queue.length; head++) {
    const below = queue[head] as CorpseRecord
    for (const memberId of pile.members) {
      if (seen.has(memberId)) continue
      const member = ctx.records.get(memberId) as CorpseRecord
      if (capsuleOf(member).position[1] <= capsuleOf(below).position[1] + SUPPORT_RISE || gapBetween(member, below) > SUPPORT_GAP) continue
      seen.add(memberId)
      falling.push(member)
      queue.push(member)
    }
  }
  return falling
}

/**
 * A corpse is gone (eaten, expired, pushed out by a newer one), frozen or not: every pile's compound is made again without it and without what rested on it (through the
 * others that rested on those), those are dynamic again and fall, and whatever else sleeps near is woken.
 */
export const releaseResting = (ctx: CorpseContext, gone: CorpseRecord): void => {
  const fallen: CorpseRecord[] = []
  for (const pile of [...ctx.piles.values()]) {
    const falling = restingOn(ctx, pile, gone)
    const leaving = new Set(falling.map((record) => record.id))
    if (gone.pile === pile.id) leaving.add(gone.id)
    if (leaving.size === 0) continue
    dropPile(ctx, pile)
    const staying = pile.members.filter((memberId) => !leaving.has(memberId))
    const rebuilt = buildCompound(ctx, pile.id, staying)
    for (const memberId of staying) (ctx.records.get(memberId) as CorpseRecord).pile = rebuilt?.id ?? 0
    fallen.push(...falling)
  }
  for (const record of fallen) {
    record.pile = 0
    record.asleep = false
    record.asleepSeconds = 0
    switchRung(ctx, record, 'r1', true)
  }
  wakeAround(ctx, [gone, ...fallen].map((record) => capsuleOf(record).position), wakeReachOf(gone))
}

/** Wakes what sleeps within `reach` metres of each of these places (what rested on a body that is gone must fall). */
export const wakeAround = (ctx: CorpseContext, centers: readonly Vec3[], reach: number): void => {
  for (const at of centers) ctx.world.wakeInBox([at[0] - reach, at[1] - reach, at[2] - reach], [at[0] + reach, at[1] + reach, at[2] + reach])
}

/** The reach a corpse's neighbours are woken within: its own length and a margin. */
export const wakeReachOf = (record: CorpseRecord): number => halfLengthOf(record) + radiusOf(record) + WAKE_MARGIN
