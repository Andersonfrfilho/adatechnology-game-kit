import type { AttachmentDef, AttachmentId, WeaponSnapshot } from './attachment-types'
import type { IsCompatible } from './attachments'
import type {
  AmmoDef,
  AmmoKind,
  CaliberDef,
  ExplosiveDef,
  TriggerResult,
  WeaponDef,
  WeaponId,
  WeaponState,
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
  /** Kind of round loaded (the calibre's own kind when absent) and the ammo table it is looked up in. */
  ammoKind?: AmmoKind
  ammo?: ReadonlyMap<string, AmmoDef>
  /** The accessories of the arsenal, by id (without them the weapon carries only its own numbers). */
  attachments?: ReadonlyMap<AttachmentId, AttachmentDef>
  isCompatible?: IsCompatible
  /** Makes the state of the launcher under the barrel (`attachment.launcher`), from the seed given and, when restoring, its own snapshot. */
  makeUnderbarrel?: (id: WeaponId, seed: number, snapshot?: WeaponSnapshot) => WeaponState
  /** Weapon, with its parts and ammunition, to start from instead of a fresh one. */
  snapshot?: WeaponSnapshot
}

/** Something that happens at a later time of the weapon clock. */
export interface Scheduled {
  readonly at: number
  readonly tag?: 'reload'
  readonly event?: WeaponEvent
  readonly apply?: () => void
}

export const FAULT_RNG_SALT = 0x6a09e667
/** Stream of the fuse sampling: separate from the spread and the faults, so a sampled fuse never shifts a shot. */
export const FUSE_RNG_SALT = 0xbb67ae85
/** Stream that draws the shot a home-made suppressor breaks on: separate, so a break never moves a spread or a fault. */
export const BREAK_RNG_SALT = 0x3c6ef372
/** Seed of the launcher under the barrel: its own streams, so the rifle's spread does not move. */
export const UNDERBARREL_SEED_SALT = 0xa54ff53a

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
