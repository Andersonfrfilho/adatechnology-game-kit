import type {
  CaliberDef,
  ExplosiveDef,
  TriggerResult,
  WeaponDef,
  WeaponEvent,
  WeaponRules,
} from './types'

export const EPS = 1e-9
/** Total spread (base + bloom) never exceeds this many times the base spread. */
export const BLOOM_CAP = 4

/** Muzzle energy in joules of ONE projectile (a bullet, or one pellet): 0.5 × mass × speed², speed scaled by the barrel factor. */
export const muzzleEnergy = (caliber: CaliberDef, barrel = 1): number => {
  const v = caliber.muzzleSpeed * barrel
  return 0.5 * (caliber.bulletGrams / 1000) * v * v
}

export interface WeaponStateInit {
  def: WeaponDef
  caliber: CaliberDef | null
  seed: number
  reserve?: number
  rules: WeaponRules
  /** What a launcher shoots, or the explosive a throwable carries. */
  explosive?: ExplosiveDef | null
  condition?: string
  ammoQuality?: string
}

/** Something that happens at a later time of the weapon clock. */
export interface Scheduled {
  readonly at: number
  readonly tag?: 'reload'
  readonly event: WeaponEvent
  readonly apply?: () => void
}

export const FAULT_RNG_SALT = 0x6a09e667

export const findById = <TEntry extends { readonly id: string }>(entries: readonly TEntry[], id: string, label: string): TEntry => {
  const found = entries.find((entry) => entry.id === id)
  if (!found) throw new Error(`game-weapons: unknown ${label} "${id}"`)
  return found
}

export const result = (status: TriggerResult['status'], extra: Partial<TriggerResult> = {}): TriggerResult => ({
  shots: [],
  uses: [],
  status,
  recoil: [0, 0],
  noise: 0,
  rounds: 0,
  roundTimes: [],
  ...extra,
})

/** Runtime of one weapon. See `WeaponState` for the contract. */
