import { type Holder, type Slot, install, isFree, stepFade, vacate } from './slots'
import type { LightKind, ThreeForLights } from './types'

export type ArbiterCore = {
  readonly THREE: ThreeForLights
  readonly slots: Record<LightKind, readonly Slot[]>
  readonly urgentReserve: number
  readonly fadeMs: number
  readonly hysteresis: number
  preempted: number
  refused: number
}

/** The slots requests and sources compete for: not leased, and shadow slots only on their own pass. */
export function poolOf(core: ArbiterCore, kind: LightKind, shadow: boolean): Slot[] {
  return core.slots[kind].filter((slot) => !slot.leased && slot.shadow === shadow)
}

function contribution(holder: Holder): number {
  return holder.values.intensity / Math.max(1, holder.distance) ** 2
}

/** Lowest priority first; on a tie, the smallest perceived contribution. */
function isWeaker(a: Holder, b: Holder): boolean {
  if (a.priority !== b.priority) return a.priority < b.priority
  return contribution(a) < contribution(b)
}

function pickFree(slots: readonly Slot[]): Slot | undefined {
  let best: Slot | undefined
  for (const slot of slots) if (isFree(slot) && (best === undefined || slot.fade < best.fade)) best = slot
  return best
}

/** Gives a free slot to the holder: at once when its light is dark or the holder is urgent, else after the slot finishes fading out. */
function place(core: ArbiterCore, slot: Slot, holder: Holder): void {
  holder.slot = slot
  if (slot.fade > 0 && !holder.urgent) {
    slot.pending = holder
    slot.fadeTarget = 0
    return
  }
  install(core.THREE, slot, holder, holder.kind === 'request')
}

/** Takes the slot from its holder; a request is told and dies, a source goes back to the queue. */
function evict(core: ArbiterCore, slot: Slot, challenger: Holder, cut: boolean): void {
  const victim = slot.holder
  if (victim === null) return
  victim.slot = null
  if (victim.kind === 'request') {
    victim.alive = false
    victim.onLost?.()
  }
  core.preempted++
  vacate(slot, cut ? 0 : core.fadeMs)
  if (cut) {
    install(core.THREE, slot, challenger, true)
    return
  }
  slot.pending = challenger
  challenger.slot = slot
}

function weakestHolder(slots: readonly Slot[]): Slot | undefined {
  let weakest: Slot | undefined
  for (const slot of slots) {
    if (slot.holder === null || slot.pending !== null) continue
    if (weakest === undefined || isWeaker(slot.holder, weakest.holder as Holder)) weakest = slot
  }
  return weakest
}

/** Slots free to a holder that has no right to the urgent reserve. */
function freeBeyondReserve(core: ArbiterCore, pool: readonly Slot[], reserve: number): Slot | undefined {
  const free = pool.filter(isFree)
  return free.length > reserve ? pickFree(pool) : undefined
}

export function admitRequest(core: ArbiterCore, holder: Holder): boolean {
  const pool = poolOf(core, holder.lightKind, false)
  const reserve = holder.lightKind === 'point' ? core.urgentReserve : 0
  const free = holder.urgent ? pickFree(pool) : freeBeyondReserve(core, pool, reserve)
  if (free !== undefined) {
    place(core, free, holder)
    return true
  }
  const victim = weakestHolder(pool)
  if (victim === undefined || (victim.holder as Holder).priority >= holder.priority) {
    core.refused++
    return false
  }
  evict(core, victim, holder, holder.urgent)
  return true
}

function beats(challenger: Holder, incumbent: Holder, hysteresis: number): boolean {
  if (challenger.priority !== incumbent.priority) return challenger.priority > incumbent.priority
  return challenger.distance < incumbent.distance * (1 - hysteresis)
}

function bestFirst(a: Holder, b: Holder): number {
  return b.priority - a.priority || a.distance - b.distance
}

/** Hands the pool's slots to the wanted sources: best first, an incumbent only yields to a clearly better challenger. */
export function arbitrateSources(core: ArbiterCore, pool: readonly Slot[], sources: readonly Holder[], reserve: number): void {
  for (const slot of pool) {
    const holder = slot.holder
    if (slot.pending?.kind === 'source' && !slot.pending.wanted) {
      slot.pending.slot = null
      slot.pending = null
    }
    if (holder?.kind === 'source' && !holder.wanted) {
      holder.slot = null
      vacate(slot, core.fadeMs)
    }
  }
  const challengers = sources.filter((source) => source.wanted && source.slot === null).sort(bestFirst)
  for (const challenger of challengers) {
    const free = freeBeyondReserve(core, pool, reserve)
    if (free !== undefined) {
      place(core, free, challenger)
      continue
    }
    const incumbentSlots = pool.filter((slot) => slot.holder?.kind === 'source')
    let worst: Slot | undefined
    for (const slot of incumbentSlots) {
      if (slot.pending !== null) continue
      if (worst === undefined || bestFirst(slot.holder as Holder, worst.holder as Holder) > 0) worst = slot
    }
    if (worst === undefined || !beats(challenger, worst.holder as Holder, core.hysteresis)) break
    evict(core, worst, challenger, false)
  }
}

export function stepSlots(core: ArbiterCore, dtSeconds: number): void {
  for (const kind of ['point', 'spot'] as const) {
    for (const slot of core.slots[kind]) {
      stepFade(slot, dtSeconds, core.fadeMs)
      if (slot.pending !== null && slot.fade <= 0) install(core.THREE, slot, slot.pending, false)
    }
  }
}
