import type { BodyId, Vec3 } from './contract'
import { wakeRecord } from './engine-corpses-swap'
import type { CorpseContext, CorpseRecord } from './engine-corpses-types'

/** What a step's travel of the interest adds when the points are not the same ones as last time (a player joined, a split screen opened): everything dormant is near again. */
const NEW_INTEREST_TRAVEL = 1e9

export const advanceTravel = (ctx: CorpseContext, interest: readonly Vec3[]): void => {
  if (ctx.interest.length !== interest.length * 2) {
    ctx.interest = new Float64Array(interest.length * 2)
    ctx.travel += NEW_INTEREST_TRAVEL
  } else {
    for (let index = 0; index < interest.length; index++) {
      const point = interest[index] as Vec3
      ctx.travel += Math.hypot(point[0] - (ctx.interest[index * 2] as number), point[2] - (ctx.interest[index * 2 + 1] as number))
    }
  }
  for (let index = 0; index < interest.length; index++) {
    ctx.interest[index * 2] = (interest[index] as Vec3)[0]
    ctx.interest[index * 2 + 1] = (interest[index] as Vec3)[2]
  }
}

const ACTIVE: BodyId[] = []

/** A dormant corpse whose body the engine woke (a body fell on it, a blast): it is walked again. The engine lists what is awake in one crossing; the sleepers are not asked. */
export const wakeThoseWoken = (ctx: CorpseContext): void => {
  ctx.world.readActiveBodies(ACTIVE)
  for (const body of ACTIVE) {
    const owner = ctx.ownerOf.get(body)
    const record = owner === undefined ? undefined : ctx.records.get(owner)
    if (record?.dormant) wakeRecord(ctx, record)
  }
}

export const ARRIVED: CorpseRecord[] = []

/** The dormant corpses the interest has come near enough to for their rung to be in question again. */
export const collectArrived = (ctx: CorpseContext): void => {
  ARRIVED.length = 0
  while (ctx.dormant.peek() <= ctx.travel) {
    const key = ctx.dormant.peek()
    const record = ctx.dormant.pop() as CorpseRecord
    if (!record.dormant || record.dormantKey !== key || ctx.records.get(record.id) !== record) continue
    wakeRecord(ctx, record)
    ARRIVED.push(record)
  }
}

/**
 * How far (m) the interest must travel before the corpse's rung could change by distance, or undefined when it cannot be left alone: a ragdoll, one that is awake, one with a body
 * on it, one whose change by distance is already armed (it waits only for time), and everything while a pile keeps only its nearest chains (that is ranked by the others).
 */
export const marginOf = (ctx: CorpseContext, record: CorpseRecord, hasBodyAbove: boolean): number | undefined => {
  const { chainDistance, chainReturnDistance, unloadDistance, loadDistance, pileChainsMax } = ctx.lod.numbers
  if (record.rung === 'r2f') return Infinity
  if (pileChainsMax !== Infinity || record.rung === 'r0') return undefined
  if (record.rung !== 'r3' && (!record.asleep || record.stale || hasBodyAbove)) return undefined
  let margin: number
  if (record.rung === 'r1') margin = chainDistance - record.distance
  else if (record.rung === 'r2') margin = Math.min(unloadDistance - record.distance, record.woken ? record.distance - chainReturnDistance : Infinity)
  else margin = record.distance - loadDistance
  return margin > 0 ? margin : undefined
}

/** The heap is only added to; once it holds far more than there are corpses, the entries of those that woke are let go. */
export const compactHeap = (ctx: CorpseContext): void => {
  if (ctx.dormant.size <= ctx.records.size * 4 + 64) return
  ctx.dormant.clear()
  for (const record of ctx.records.values()) if (record.dormant && record.dormantKey !== Infinity) ctx.dormant.push(record.dormantKey, record)
}
