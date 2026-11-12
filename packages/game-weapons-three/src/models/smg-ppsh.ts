import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'
import { profileBlock } from './wood-profile'
import type { ProfilePoint } from './wood-profile'

// The PPSh-41 as the reference photo shows it (right side): metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel.

const RECEIVER_START = 0.29
const RECEIVER_END = 0.55
const JACKET_START = 0.45
const JACKET_END = 0.775
const JACKET_RADIUS = 0.0205
const MAG_X = 0.5
const GRIP_X = 0.255

const STOCK_PROFILE: readonly ProfilePoint[] = [[0, -0.026, -0.14], [0.08, -0.022, -0.11], [0.17, -0.01, -0.08], [0.25, -0.004, -0.062], [0.29, -0.004, -0.055], [0.5, -0.012, -0.05]]

/** The one-piece wooden stock, from the butt to the wood that wraps the underside of the receiver, and the pivot of the wrist the right hand holds. */
function buildStock(kit: ModelKit, group: Parent, parts: ModelParts): void {
  kit.box(group, 0.012, 0.118, 0.04, kit.M.dark, 0.006, -0.083, 0)
  profileBlock(kit, group, STOCK_PROFILE, 0.038, kit.M.woodL)
  const grip = kit.pivot(group, GRIP_X, -0.03, 0)
  grip.rotation.z = -0.3
  parts.grip = grip
}

/** The stamped receiver with its hinged cover, the cocking handle on the right, the trigger and the guard. */
function buildReceiver(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  const length = RECEIVER_END - RECEIVER_START
  box(group, length, 0.038, 0.044, M.metal, RECEIVER_START + length / 2, 0.003, 0)
  box(group, length * 0.9, 0.006, 0.04, M.dark, RECEIVER_START + length * 0.46, 0.024, 0)
  box(group, 0.05, 0.012, 0.004, M.hole, 0.46, 0.008, 0.0222)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.07
  box(bolt, 0.012, 0.012, 0.012, M.steelL, 0.43, 0.006, 0.027)
  kit.sphere(bolt, 0.007, M.steelL, 0.43, 0.006, 0.036, 1)
  box(group, 0.06, 0.004, 0.012, M.metal, 0.35, -0.032, 0)
  box(group, 0.004, 0.026, 0.012, M.metal, 0.38, -0.02, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.006, M.dark, 0.335, -0.02, 0, 0.15)
}

/** The perforated barrel jacket with its slots, the slanted muzzle brake at the front and the tangent rear sight standing on it. */
function buildJacket(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  const jacketLength = JACKET_END - JACKET_START
  heatify(parts.glow, cylinderX(group, 0.0098, length - JACKET_START, M.metal, (length + JACKET_START) / 2, 0, 0, 16))
  cylinderX(group, JACKET_RADIUS, jacketLength, M.metal, JACKET_START + jacketLength / 2, 0, 0, 20)
  for (const x of [0.575, 0.62, 0.665, 0.71]) for (const side of [-1, 1]) box(group, 0.03, 0.016, 0.004, M.hole, x, 0.002, side * JACKET_RADIUS)
  cylinderX(group, 0.0215, 0.06, M.dark, (JACKET_END + length) / 2 - 0.004, 0, 0, 20)
  box(group, 0.03, 0.02, 0.046, M.hole, length - 0.034, 0.004, 0, 0.5)
  box(group, 0.03, 0.01, 0.026, M.dark, 0.745, 0.026, 0)
  box(group, 0.004, 0.034, 0.012, M.steelL, 0.745, 0.04, 0, -0.2)
  box(group, 0.01, 0.014, 0.01, M.dark, length - 0.02, 0.028, 0)
}

/** The 71-round drum under the receiver (its axis along the barrel) or the 35-round curved box. */
function buildMagazine(kit: ModelKit, group: Parent, parts: ModelParts, options: ModelOptions): void {
  const { M, box, cylinderX } = kit
  const magazine = kit.pivot(group, MAG_X, -0.012, 0)
  parts.mag = magazine
  if (options.mag === 'curved') {
    box(magazine, 0.034, 0.17, 0.03, M.metal, 0.0, -0.09, 0, 0.12)
    box(magazine, 0.038, 0.01, 0.034, M.dark, 0.018, -0.172, 0, 0.12)
    parts.magDrop = 0.2
    return
  }
  box(magazine, 0.05, 0.03, 0.04, M.metal, 0, -0.008, 0)
  cylinderX(magazine, 0.08, 0.046, M.metal, 0, -0.085, 0, 28)
  cylinderX(magazine, 0.07, 0.052, M.dark, 0, -0.085, 0, 24)
  cylinderX(magazine, 0.022, 0.05, M.steel, 0, -0.085, 0, 14)
  for (const angle of [0, 1.05, 2.1, 3.15, 4.2, 5.25]) box(magazine, 0.048, 0.012, 0.006, M.metal, 0, -0.085 + Math.cos(angle) * 0.052, Math.sin(angle) * 0.052, 0, 0, angle)
  parts.magDrop = 0.2
}

/** The PPSh-41: wooden stock in one piece, stamped receiver, perforated jacket with the slanted brake, drum or curved box and the tangent sight. */
export function buildPpsh(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 843) / 1000
  const parts: ModelParts = { family: 'rifle', glow: [] }
  buildStock(kit, group, parts)
  buildReceiver(kit, group, parts)
  buildJacket(kit, group, parts, length)
  buildMagazine(kit, group, parts, options)
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: 0.0098,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: 0.05,
    receiverWidth: 0.044,
    handguardEnd: 0.68,
    magazineX: MAG_X,
    gripX: GRIP_X,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.46, 0.008, 0.025)
  parts.loadPort = kit.mark(group, MAG_X, -0.02, 0)
  parts.topLoad = kit.mark(group, 0.46, 0.028, 0)
  return { group, parts }
}
