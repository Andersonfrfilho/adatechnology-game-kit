import { DEFAULT_RULES } from './rules'
import type { ItemRules, StorageId } from './rules-types'
import type { ItemDef } from './types'

export type Freshness = 'fresh' | 'stale' | 'spoiled' | 'rotten'

/**
 * What an item remembers about its age. Nothing ticks: the account is closed lazily, when the item moves or someone looks at it.
 * Times are in days on the host's clock.
 */
export interface AgeState {
  /** Effective age: days at room temperature. */
  ageDays: number
  /** Time at which `ageDays` was last closed. */
  since: number
  storage: StorageId
  /** Time at which the item entered `storage` (a cooler only helps for its first days). */
  storedAt: number
  /** Replaces the item's shelf life (a thawed freezer leaves 2 days). */
  shelfLife?: number
}

export interface AgeOptions {
  /** Whether the storage has power right now (fridge, freezer). Default true. */
  powered?: boolean
  rules?: ItemRules
}

const storageRuleOf = (rules: ItemRules, storage: StorageId) => {
  const rule = rules.storage[storage]
  if (!rule) throw new Error(`game-items: unknown storage "${storage}"`)
  return rule
}

/** The multiplier of the age at one instant: `heldDays` is how long the item has been in `storage`. */
export const storageMultiplier = (storage: StorageId, options: AgeOptions & { heldDays?: number } = {}): number => {
  const { powered = true, rules = DEFAULT_RULES, heldDays = 0 } = options
  const rule = storageRuleOf(rules, storage)
  if (rule.needsPower && !powered) return 1
  if (rule.limitDays !== undefined && heldDays >= rule.limitDays) return rule.afterLimit ?? 1
  return rule.multiplier
}

/** Days of effective age accrued between `from` and `to` in a storage the item entered at `storedAt`. */
const accruedDays = (storage: StorageId, window: { storedAt: number; from: number; to: number }, options: AgeOptions): number => {
  const { powered = true, rules = DEFAULT_RULES } = options
  const rule = storageRuleOf(rules, storage)
  const elapsed = window.to - window.from
  if (elapsed <= 0) return 0
  if (rule.needsPower && !powered) return elapsed
  if (rule.limitDays === undefined) return elapsed * rule.multiplier
  const limitEnd = window.storedAt + rule.limitDays
  const early = Math.max(0, Math.min(window.to, limitEnd) - Math.max(window.from, window.storedAt))
  return early * rule.multiplier + (elapsed - early) * (rule.afterLimit ?? 1)
}

/** Closes the account up to `now`: `ageDays += (now - since) x multiplier`. Pure: returns the new state. */
export const advanceAge = (state: AgeState, now: number, options: AgeOptions = {}): AgeState => {
  const { powered = true, rules = DEFAULT_RULES } = options
  const rule = storageRuleOf(rules, state.storage)
  const thawDays = rules.aging.thawShelfDays[state.storage]
  const isThawing = rule.needsPower === true && !powered && thawDays !== undefined && state.shelfLife === undefined
  const base = isThawing ? { ...state, ageDays: 0, shelfLife: thawDays } : state
  const ageDays = base.ageDays + accruedDays(state.storage, { storedAt: state.storedAt, from: state.since, to: now }, options)
  return { ...base, ageDays, since: Math.max(now, state.since) }
}

/** Moves the item to another storage: closes the account in the old one, then the new multiplier applies from `now`. */
export const moveToStorage = (state: AgeState, now: number, storage: StorageId, options: AgeOptions = {}): AgeState => ({
  ...advanceAge(state, now, options),
  storage,
  storedAt: now,
})

/** Age as a share of the shelf life; 0 for an item that does not spoil. */
export const shelfRatio = (item: ItemDef, state: AgeState): number => {
  const shelfLife = state.shelfLife ?? item.shelfLife
  return shelfLife === undefined ? 0 : state.ageDays / shelfLife
}

/** `fresh`, `stale`, `spoiled` or `rotten` at 0.5, 1 and 1.5 of the shelf life (the rule's `freshness`). Closes the account up to `now` first. */
export const freshness = (item: ItemDef, state: AgeState, now: number, options: AgeOptions = {}): Freshness => {
  const { rules = DEFAULT_RULES } = options
  const ratio = shelfRatio(item, advanceAge(state, now, options))
  if (ratio >= rules.freshness.rotten) return 'rotten'
  if (ratio >= rules.freshness.spoiled) return 'spoiled'
  if (ratio >= rules.freshness.stale) return 'stale'
  return 'fresh'
}

/** Charge left (0..1) of a battery-like item: it loses `charge.lossPerMonth` of the full charge per 30 days of effective age. */
export const chargeLevel = (item: ItemDef, initialCharge: number, ageDays: number): number => {
  if (!item.charge) return initialCharge
  return Math.max(0, initialCharge - item.charge.lossPerMonth * (ageDays / 30))
}

/** True when one use of an old fuel-like item fails: past `agingFault.afterDays` each use fails with probability `chance`. Draws once, only when it can fail. */
export const failsToStart = (item: ItemDef, ageDays: number, random: () => number): boolean => {
  if (!item.agingFault || ageDays <= item.agingFault.afterDays) return false
  return random() < item.agingFault.chance
}
