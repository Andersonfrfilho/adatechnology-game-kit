import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The VSS Vintorez as the reference photo shows it: metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel and its suppressor.

const RECEIVER_START = 0.28
const RECEIVER_END = 0.48
const SUPPRESSOR_START = 0.58
const SUPPRESSOR_RADIUS = 0.0215
const GRIP_X = 0.29
const MAG_X = 0.435

/** The skeletal wooden stock: perforated rubber pad, the two bars joined by the rear and middle uprights (two windows between them) and the pistol grip. */
function buildStock(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  box(group, 0.012, 0.115, 0.038, M.rubber, 0.006, -0.066, 0)
  box(group, 0.05, 0.12, 0.034, M.beech, 0.035, -0.066, 0)
  box(group, 0.27, 0.036, 0.042, M.beech, 0.16, -0.026, 0, 0.05)
  box(group, 0.29, 0.032, 0.038, M.beech, 0.175, -0.108, 0, 0.01)
  box(group, 0.034, 0.1, 0.030, M.beech, 0.195, -0.066, 0)
  const grip = kit.pivot(group, GRIP_X, -0.07, 0)
  grip.rotation.z = -0.25
  parts.grip = grip
  box(grip, 0.052, 0.12, 0.042, M.beech, 0, 0, 0)
}

/** The AK-like receiver with its dust cover, the cocking handle and ejection port on the right, the selector flap, the trigger group and the 10-round box magazine. */
function buildReceiver(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  const length = RECEIVER_END - RECEIVER_START
  box(group, length, 0.076, 0.04, M.metal, RECEIVER_START + length / 2, -0.003, 0)
  box(group, length * 0.95, 0.014, 0.038, M.dark, RECEIVER_START + length * 0.48, 0.036, 0)
  box(group, 0.05, 0.016, 0.004, M.hole, 0.41, 0.012, 0.0202)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.06
  box(bolt, 0.044, 0.012, 0.006, M.steelL, 0.41, 0.012, 0.0228)
  box(bolt, 0.012, 0.012, 0.02, M.metal, 0.42, 0.016, 0.03)
  kit.sphere(bolt, 0.0065, M.metal, 0.42, 0.016, 0.042, 1)
  box(group, 0.12, 0.012, 0.003, M.metal, 0.38, -0.022, 0.0205, -0.05)
  box(group, 0.075, 0.004, 0.012, M.metal, 0.34, -0.052, 0)
  box(group, 0.004, 0.026, 0.012, M.metal, 0.376, -0.04, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.006, M.dark, 0.32, -0.04, 0, 0.15)
  const magazine = kit.pivot(group, MAG_X, -0.04, 0)
  magazine.rotation.z = 0.1
  parts.mag = magazine
  parts.magDrop = 0.1
  box(magazine, 0.056, 0.09, 0.026, M.polyMag, 0, -0.045, 0)
  for (let i = 0; i < 4; i++) box(magazine, 0.04, 0.003, 0.028, M.dark, 0.003, -0.02 - i * 0.02, 0)
}

/** The wrapped handguard, the thick integral suppressor over the whole barrel with its ring and end cap, and the rear and front sights. */
function buildSuppressor(kit: ModelKit, group: Parent, length: number): void {
  const { M, box, cylinderX } = kit
  const wrapLength = SUPPRESSOR_START - RECEIVER_END
  box(group, wrapLength + 0.01, 0.062, 0.046, M.poly, RECEIVER_END + wrapLength / 2, -0.002, 0)
  const bodyLength = length - SUPPRESSOR_START
  cylinderX(group, SUPPRESSOR_RADIUS, bodyLength, M.dark, SUPPRESSOR_START + bodyLength / 2, 0, 0, 24)
  cylinderX(group, SUPPRESSOR_RADIUS + 0.001, 0.012, M.metal, 0.66, 0, 0, 24)
  cylinderX(group, SUPPRESSOR_RADIUS + 0.003, 0.034, M.metal, length - 0.02, 0, 0, 24)
  cylinderX(group, 0.0075, 0.004, M.hole, length + 0.0005, 0, 0, 12)
  box(group, 0.05, 0.014, 0.022, M.dark, 0.61, 0.0375, 0)
  box(group, 0.03, 0.006, 0.018, M.steelL, 0.615, 0.047, 0, 0.1)
  box(group, 0.016, 0.022, 0.014, M.dark, length - 0.022, 0.0315, 0)
  box(group, 0.004, 0.012, 0.004, M.steelL, length - 0.022, 0.048, 0)
}

/** The VSS Vintorez: integral suppressor over the whole barrel, AK-like receiver, skeletal wooden stock and 10-round box magazine. */
export function buildVss(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 894) / 1000
  const parts: ModelParts = { family: 'rifle', glow: [] }
  buildStock(kit, group, parts)
  buildReceiver(kit, group, parts)
  buildSuppressor(kit, group, length)
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: SUPPRESSOR_RADIUS,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: 0.076,
    receiverWidth: 0.04,
    handguardEnd: 0.6,
    magazineX: MAG_X,
    gripX: GRIP_X,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.41, 0.012, 0.0225)
  parts.loadPort = kit.mark(group, MAG_X, -0.04, 0)
  parts.topLoad = kit.mark(group, 0.41, 0.045, 0)
  return { group, parts }
}
