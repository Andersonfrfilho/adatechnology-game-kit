import { freezeCorpses } from './engine-corpses-pile'
import type { CorpseBodiesState } from './engine-corpses'
import type { AddLyingCorpseParams, CorpseContext } from './engine-corpses-types'
import type { CorpseBodyKit } from './corpse-pose'
import type { BodyRung } from './body-lod'
import type { Quat, Vec3 } from './contract'

const RUNG_FOR_LYING: Readonly<Record<BodyRung, AddLyingCorpseParams['rung']>> = { r0: 'r1', r1: 'r1', r2: 'r2', r2f: 'r2', r3: 'r3' }

/**
 * `restoreFresh` of `createCorpseBodies`: the corpses of a save made in another world, laid in this one oldest first (the order the bodies were made in) where each torso
 * lay. A body that was falling is made where it was, at rest; a ragdoll (R0, made only by a death) comes back as its chain (R1) and a pile is frozen again with the members it had.
 */
export const restoreFresh = (
  ctx: CorpseContext,
  state: CorpseBodiesState,
  kitOf: (id: number) => CorpseBodyKit | undefined,
  addLying: (params: AddLyingCorpseParams) => BodyRung,
): boolean => {
  if (ctx.records.size > 0) return false
  const kits = state.records.map((saved) => kitOf(saved.id))
  if (kits.some((kit) => kit === undefined)) return false
  ctx.tick = state.tick
  ctx.travel = state.travel
  ctx.interest = Float64Array.from(state.interest)
  const ordered = state.records.map((saved, index) => ({ saved, kit: kits[index] as CorpseBodyKit })).sort((a, b) => a.saved.born - b.saved.born)
  for (const { saved, kit } of ordered) {
    const position = saved.torso.slice(0, 3) as unknown as Vec3
    const rotation = saved.torso.slice(3, 7) as unknown as Quat
    addLying({ id: saved.id, kit, torso: { position, rotation }, rung: RUNG_FOR_LYING[saved.rung] })
    const record = ctx.records.get(saved.id)
    if (!record) return false
    record.originX = saved.originX
    record.originZ = saved.originZ
    record.asleepSeconds = saved.asleepSeconds
    record.sinceChangeSeconds = saved.sinceChangeSeconds
    record.woken = saved.woken
  }
  for (const pile of state.piles) {
    const members = pile.members.flatMap((id) => ctx.records.get(id) ?? [])
    if (members.length > 0) freezeCorpses(ctx, members)
  }
  ctx.born = Math.max(ctx.born, state.born)
  ctx.nextPile = Math.max(ctx.nextPile, state.nextPile)
  return true
}
