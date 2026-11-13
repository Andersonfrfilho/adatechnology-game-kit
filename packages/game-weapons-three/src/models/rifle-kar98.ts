import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'
import { profileBlock } from './wood-profile'
import type { ProfilePoint } from './wood-profile'

// The Mauser Kar98k as the reference photo shows it: metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel.

const RECEIVER_START = 0.29
const RECEIVER_END = 0.5
const BAND_X = 0.85
const NOSE_X = 0.95
const BOLT_X = 0.33

const STOCK_PROFILE: readonly ProfilePoint[] = [
  [0, -0.05, -0.169], [0.1, -0.04, -0.15], [0.2, -0.028, -0.125], [0.26, -0.02, -0.104], [0.3, -0.012, -0.088], [0.34, -0.004, -0.06], [0.42, 0, -0.045],
  [0.5, 0.011, -0.035], [0.84, 0.011, -0.03], [0.86, -0.006, -0.03], [0.93, -0.006, -0.03],
]

/** The wooden stock in one piece cut from the photo's profile (comb, wrist with its finger groove, forend to the nose cap), and its steel butt plate. */
function buildStock(kit: ModelKit, group: Parent): void {
  kit.box(group, 0.012, 0.12, 0.04, kit.M.dark, 0.006, -0.108, 0)
  profileBlock(kit, group, STOCK_PROFILE, 0.036, kit.M.beech)
  kit.box(group, 0.02, 0.016, 0.014, kit.M.dark, 0.1, -0.1, 0.021)
}

/** The receiver ring, the bolt with its turned-down handle, the ejection port and the flush floorplate of the internal magazine. */
function buildAction(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderX, cylinderZ } = kit
  cylinderX(group, 0.0165, RECEIVER_END - RECEIVER_START, M.metal, (RECEIVER_START + RECEIVER_END) / 2, 0, 0, 20)
  cylinderX(group, 0.0185, 0.07, M.steel, 0.325, 0, 0, 20)
  cylinderX(group, 0.0115, 0.04, M.dark, 0.285, 0, 0, 16)
  box(group, 0.05, 0.012, 0.004, M.hole, 0.42, 0.004, 0.0165)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.07
  box(bolt, 0.044, 0.01, 0.006, M.steelL, 0.42, 0.004, 0.0191)
  const handle = kit.pivot(group, BOLT_X, 0, 0)
  parts.boltHandle = handle
  parts.boltHandleRest = handle.position.x
  cylinderZ(handle, 0.0042, 0.05, M.steelL, 0, -0.006, 0.037, 12).rotation.x = 1.35
  kit.sphere(handle, 0.0105, M.dark, 0, -0.022, 0.058, 1)
  box(group, 0.09, 0.006, 0.03, M.metal, 0.39, -0.06, 0)
  box(group, 0.07, 0.004, 0.012, M.metal, 0.365, -0.083, 0)
  box(group, 0.004, 0.034, 0.012, M.metal, 0.33, -0.066, 0)
  box(group, 0.004, 0.034, 0.012, M.metal, 0.4, -0.066, 0)
  parts.trigger = box(group, 0.004, 0.018, 0.006, M.dark, 0.355, -0.054, 0, 0.15)
}

/** The barrel, the tangent rear sight on its base, the single barrel band, the nose cap with its bayonet lug and the hooded front sight. */
function buildBarrel(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  heatify(parts.glow, cylinderX(group, 0.0085, length - RECEIVER_END, M.metal, (length + RECEIVER_END) / 2, 0, 0, 16))
  cylinderX(group, 0.0115, 0.06, M.metal, RECEIVER_END + 0.03, 0, 0, 16)
  box(group, 0.075, 0.012, 0.02, M.dark, 0.6, 0.0175, 0)
  box(group, 0.06, 0.004, 0.012, M.steelL, 0.605, 0.025, 0, 0.12)
  cylinderX(group, 0.0215, 0.014, M.metal, BAND_X, -0.004, 0, 18)
  box(group, 0.04, 0.026, 0.032, M.metal, NOSE_X, -0.012, 0)
  box(group, 0.008, 0.014, 0.01, M.metal, NOSE_X + 0.004, -0.032, 0)
  cylinderX(group, 0.0118, 0.022, M.dark, length - 0.04, 0, 0, 16)
  box(group, 0.022, 0.018, 0.012, M.dark, length - 0.04, 0.014, 0)
  cylinderX(group, 0.0045, 0.004, M.hole, length + 0.0005, 0, 0, 12)
}

/** The Mauser Kar98k: long bolt action, full wooden stock, one barrel band, nose cap and the internal five-round magazine flush with the stock. */
export function buildKar98(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 1110) / 1000
  const parts: ModelParts = { family: 'bolt', glow: [] }
  buildStock(kit, group)
  buildAction(kit, group, parts)
  buildBarrel(kit, group, parts, length)
  parts.mag = null
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: 0.0085,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: 0.036,
    receiverWidth: 0.034,
    handguardEnd: 0.84,
    magazineX: 0.39,
    gripX: 0.3,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.42, 0.004, 0.02)
  parts.loadPort = kit.mark(group, 0.39, -0.06, 0)
  parts.topLoad = kit.mark(group, 0.4, 0.02, 0)
  return { group, parts }
}
