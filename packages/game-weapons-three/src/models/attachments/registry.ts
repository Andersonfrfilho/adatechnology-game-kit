import { buildAmmoBackpack } from './ammo-backpack'
import { buildBipodModel } from './bipod'
import { buildForegrip } from './foregrip'
import { buildLaser } from './laser'
import { buildLight } from './light'
import { buildDrumMagazine, buildDualCoupler, buildExtendedMagazine } from './magazine'
import { buildCompensator, buildMuzzleBrake } from './muzzle-device'
import { OPTIC_MODEL_IDS, buildOptic } from './optic'
import { buildSling } from './sling'
import { buildSuppressor } from './suppressor'
import { buildTripod } from './tripod'
import type { AttachmentModelRegistry } from './types'
import { buildUnderbarrelLauncher } from './ugl'

/**
 * The model of each accessory by `AttachmentDef.model`. The ports of the gallery (optics, bipod, brakes, drum, belt box, rail) draw what the page draws; the others are creations of the
 * kit. Accessories without a model (the barrel swaps, the integral optics the weapon already draws) are simply not drawn.
 */
export const ATTACHMENT_MODELS: AttachmentModelRegistry = {
  ...Object.fromEntries(OPTIC_MODEL_IDS.map((id) => [id, buildOptic])),
  bipod: buildBipodModel,
  muzzle_brake: buildMuzzleBrake(1),
  muzzle_brake_heavy: buildMuzzleBrake(2),
  compensator: buildCompensator,
  suppressor: buildSuppressor,
  oil_filter_suppressor: buildSuppressor,
  integral_suppressor: buildSuppressor,
  vertical_grip: buildForegrip,
  weapon_light: buildLight,
  laser_sight: buildLaser,
  m203: buildUnderbarrelLauncher,
  gp_25: buildUnderbarrelLauncher,
  ag36: buildUnderbarrelLauncher,
  ammo_backpack: buildAmmoBackpack,
  tripod: buildTripod,
  sling: buildSling,
  drum_magazine: buildDrumMagazine,
  extended_magazine: buildExtendedMagazine,
  dual_coupler: buildDualCoupler,
}
