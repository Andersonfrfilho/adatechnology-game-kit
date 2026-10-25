// Copyright Ada Technology 2026 — MIT
/**
 * Muzzle smoke profiles and resolver for @adatechnology/game-weapons.
 *
 * Each profile controls the puff count, radius, opacity, lifetime, drift (forward speed),
 * rise speed, growth factor, and flash scale of the muzzle flash effect emitted on each shot.
 * The resolver picks the right profile from the calibre's propellant type, the weapon's own
 * override, and whether a suppressor is fitted.
 */
import type { CaliberDef, WeaponDef } from './types'
import PROFILES_JSON from './data/muzzle-smoke.json'

/** The visual profile of the muzzle smoke for one shot. */
export interface MuzzleSmokeProfile {
  /** Number of smoke puffs spawned. */
  readonly puffs: number
  /** Radius of each puff at spawn (multiplied by the flash-size factor). */
  readonly radius: number
  /** Starting opacity of each puff (0 = invisible, 1 = fully opaque). */
  readonly opacity: number
  /** Life of each puff in seconds. */
  readonly life: number
  /** Forward drift speed of the cloud (m/s, along the barrel). */
  readonly drift: number
  /** Upward rise speed of the cloud (m/s, world-space). */
  readonly rise: number
  /** Growth factor per second applied to each puff. */
  readonly growth: number
  /** Flash scale multiplier (0 = no flash/light, 1 = full). */
  readonly flash: number
  /** Random extra forward speed per puff (m/s); the recipe defaults to 0.1. */
  readonly driftSpread?: number
  /** Random extra rise speed per puff (m/s); the recipe defaults to 0.04. */
  readonly riseSpread?: number
  /** Total sideways speed range per puff (m/s); the recipe defaults to 0.06. */
  readonly sideSpread?: number
  /** Random extra life per puff in seconds; the recipe defaults to 0.3 times `life`. */
  readonly lifeSpread?: number
}

/** Profile id — corresponds to a top-level key of `muzzle-smoke.json`. */
export type MuzzleSmokeProfileId = 'smokeless' | 'black_powder' | 'suppressed' | 'none' | 'gallery'

/** All built-in muzzle smoke profiles, indexed by id. */
export const MUZZLE_SMOKE: Readonly<Record<MuzzleSmokeProfileId, MuzzleSmokeProfile>> = PROFILES_JSON as Readonly<Record<MuzzleSmokeProfileId, MuzzleSmokeProfile>>

export interface MuzzleSmokeParams {
  /** The calibre of the shot being fired. */
  caliber?: CaliberDef | null | undefined
  /** The weapon def (may carry a `muzzleSmoke` override). */
  weapon?: WeaponDef | undefined
  /** Whether a suppressor is fitted for this shot. */
  suppressed?: boolean | undefined
}

/**
 * Returns the muzzle smoke profile for a given shot context.
 *
 * Priority (highest first):
 * 1. `suppressed` → always returns the `suppressed` profile.
 * 2. `weapon.muzzleSmoke` → explicit weapon-level override (profile id).
 * 3. `caliber.propellant` → derived from the calibre's propellant type.
 * 4. Default: `smokeless`.
 *
 * The `gallery` profile (the Arsenal gallery's original look) is only reachable through `weapon.muzzleSmoke: 'gallery'`.
 */
export function muzzleSmokeOf({ caliber, weapon, suppressed }: MuzzleSmokeParams): MuzzleSmokeProfile {
  if (suppressed) return MUZZLE_SMOKE.suppressed
  const override = weapon?.muzzleSmoke as MuzzleSmokeProfileId | undefined
  if (override && override in MUZZLE_SMOKE) return MUZZLE_SMOKE[override]
  const id: MuzzleSmokeProfileId =
    caliber?.propellant === 'black_powder' ? 'black_powder' : caliber?.propellant === 'none' ? 'none' : 'smokeless'
  return MUZZLE_SMOKE[id]
}
