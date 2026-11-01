import { BALANCE, unit } from '@adatechnology/game-crowd'
import type { CrowdStore } from '@adatechnology/game-crowd'
import { ACCESSORY_BIT, packIdentity } from '@adatechnology/game-characters-three'
import type { IdentityLook } from '@adatechnology/game-characters-three'

/** The numbers of the look a body is given from its identity (T4b.7, D11). Every one is a default a game can change. */
export const VARIETY_DEFAULTS = {
  capChance: 0.16,
  backpackChance: 0.2,
  hoodChance: 0.1,
  /** Chance of a wound in a region at the youngest infection age, and how much each age step adds. */
  woundBase: 0.05,
  woundPerAge: 0.12,
  /** Share of the wounds that are severe. */
  severeShare: 0.35,
  /** Steps of the infection age of the pack (0 .. ageSteps). */
  ageSteps: 3,
  /** How much of a shove's push (0..1) tilts the body. */
  leanScale: 0.3,
} as const

export type CrowdVarietyNumbers = { readonly [K in keyof typeof VARIETY_DEFAULTS]: number }

/** One salt per use, so the draws of the same agent stay independent (the physics salts of `game-crowd` are its own). */
export const LOOK_SALT = { TROUSERS: 0x7a101, CAP: 0x7a202, BACKPACK: 0x7a303, HOOD: 0x7a404, WOUND: 0x7a505, FRESH: 0x7a606 } as const

const REGIONS = 6
const TROUSER_COUNT = 16
const WOUND_BITS = 2
const FRESHEST = 15
const FRESH_STEPS = 12
const LEAN_MIN = 0.02

/** The wound bits of the six regions: the game's own (`store.wounds`) or, where it has none, a draw that grows with the infection age. */
const woundsOf = (store: CrowdStore, i: number, identity: number, ageNorm: number, N: CrowdVarietyNumbers): number => {
  const own = store.wounds[i]!
  const chance = N.woundBase + N.woundPerAge * ageNorm
  let wounds = 0
  for (let region = 0; region < REGIONS; region++) {
    const draw = unit(identity, region, LOOK_SALT.WOUND)
    const drawn = draw < chance * N.severeShare ? 2 : draw < chance ? 1 : 0
    wounds |= Math.max((own >> (region * WOUND_BITS)) & 3, drawn) << (region * WOUND_BITS)
  }
  return wounds
}

const accessoriesOf = (store: CrowdStore, i: number, identity: number, N: CrowdVarietyNumbers): number => {
  let bits = store.helmet[i] ? ACCESSORY_BIT.HELMET : unit(identity, 0, LOOK_SALT.CAP) < N.capChance ? ACCESSORY_BIT.CAP : 0
  if (!bits && unit(identity, 0, LOOK_SALT.HOOD) < N.hoodChance) bits |= ACCESSORY_BIT.EXTRA
  if (unit(identity, 0, LOOK_SALT.BACKPACK) < N.backpackChance) bits |= ACCESSORY_BIT.BACKPACK
  return bits
}

/** Lean toward the push, in the body's own frame, from the store's lean (the push over its cap). */
const leanOf = (store: CrowdStore, i: number, N: CrowdVarietyNumbers): { readonly leanAngle: number; readonly leanAmount: number } => {
  const lx = store.leanX[i]!
  const lz = store.leanZ[i]!
  const size = Math.min(1, Math.hypot(lx, lz))
  if (size < LEAN_MIN) return { leanAngle: 0, leanAmount: 0 }
  const yaw = store.renderYaw[i]!
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return { leanAngle: Math.atan2(cos * lx - sin * lz, sin * lx + cos * lz), leanAmount: size * N.leanScale }
}

/** The whole look of an agent, all of it from its identity and its state in the store: it never changes with the level of detail. */
export const lookOfAgent = (store: CrowdStore, i: number, N: CrowdVarietyNumbers, extra: Pick<IdentityLook, 'clipA' | 'clipB' | 'clipBlend' | 'clipSpeed' | 'clips'> = {}): IdentityLook => {
  const identity = store.identity[i]!
  const ageNorm = Math.min(1, store.age[i]! / N.ageSteps)
  const wounds = woundsOf(store, i, identity, ageNorm, N)
  const fresh = store.wounds[i]! ? FRESHEST : Math.max(0, Math.min(FRESHEST, FRESHEST - Math.round(ageNorm * FRESH_STEPS) + Math.floor(unit(identity, 0, LOOK_SALT.FRESH) * 4)))
  return {
    wounds,
    freshness: fresh,
    trousers: Math.floor(unit(identity, 0, LOOK_SALT.TROUSERS) * TROUSER_COUNT),
    gaitStyle: store.gaitStyle[i]!,
    accessories: accessoriesOf(store, i, identity, N),
    ...leanOf(store, i, N),
    ...extra,
  }
}

export const isStaggering = (store: CrowdStore, i: number): boolean => store.balance[i] === BALANCE.STAGGERING

export const packLook = (look: IdentityLook): readonly [number, number, number, number] => packIdentity(look)
