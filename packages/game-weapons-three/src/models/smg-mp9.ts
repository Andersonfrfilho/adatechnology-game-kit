import { captured } from './capture'
import { rail } from './details'
import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The B&T MP9 as the reference photo shows it (assets/weapon-references.json): metres in the model's frame, x from the butt (stock open) to the muzzle, y up, z to the right.

const RECEIVER_START = 0.2
const RECEIVER_END = 0.49
const RECEIVER_HEIGHT = 0.052
const RECEIVER_WIDTH = 0.036
const GRIP_X = 0.332
const TOP = RECEIVER_HEIGHT / 2
const BOTTOM = -RECEIVER_HEIGHT / 2

/** The polymer receiver: the block, the flutes along the front half, the raised rear with the cocking handle, the top rail and the ejection port. */
function buildReceiver(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  const body = RECEIVER_END - RECEIVER_START
  box(group, body, RECEIVER_HEIGHT, RECEIVER_WIDTH, M.poly, RECEIVER_START + body / 2, 0, 0)
  box(group, 0.06, 0.062, 0.04, M.poly, 0.232, 0.005, 0)
  box(group, 0.03, 0.014, 0.032, M.dark, 0.222, TOP + 0.017, 0)
  box(group, 0.014, 0.012, 0.012, M.dark, 0.272, TOP + 0.012, 0, -0.5)
  rail(kit, group, 0.275, 0.175, TOP + 0.0025, 0, 0.022)
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) box(group, 0.12 - i * 0.012, 0.0025, 0.002, M.dark, 0.4 - i * 0.006, 0.014 - i * 0.0075, side * (RECEIVER_WIDTH / 2 + 0.0005))
  box(group, 0.04, 0.016, 0.004, M.hole, 0.335, 0.006, RECEIVER_WIDTH / 2 + 0.0004)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.05
  box(bolt, 0.036, 0.012, 0.006, M.steelL, 0.335, 0.006, RECEIVER_WIDTH / 2 - 0.0005)
}

/** The muzzle: a thick flash hider on the barrel, which carries the heat glow. */
function buildMuzzle(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  heatify(parts.glow, cylinderX(group, 0.0128, 0.038, M.dark, length - 0.019, 0.002, 0, 20))
  cylinderX(group, 0.0075, 0.004, M.hole, length + 0.0005, 0.002, 0, 12)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4
    box(group, 0.02, 0.0025, 0.004, M.hole, length - 0.02, 0.002 + Math.cos(angle) * 0.0126, Math.sin(angle) * 0.0126, 0, 0, angle)
  }
}

/** The trigger group: the grip with the magazine in it, the trigger guard and the vertical foregrip in front of it. */
function buildLower(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  const grip = kit.pivot(group, GRIP_X, -0.073, 0)
  grip.rotation.z = -0.1
  parts.grip = grip
  box(grip, 0.058, 0.1, 0.03, M.poly, 0, 0, 0)
  for (let i = 0; i < 3; i++) box(grip, 0.004, 0.01, 0.032, M.dark, 0.026, -0.005 - i * 0.02, 0)
  box(group, 0.004, 0.036, 0.01, M.poly, 0.405, BOTTOM - 0.018, 0)
  box(group, 0.05, 0.005, 0.01, M.poly, 0.38, BOTTOM - 0.036, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.006, M.dark, 0.378, BOTTOM - 0.016, 0, 0.15)
  box(group, 0.06, 0.02, 0.034, M.poly, 0.455, BOTTOM - 0.008, 0)
  const foregrip = kit.pivot(group, 0.455, -0.078, 0)
  foregrip.rotation.z = 0.12
  box(foregrip, 0.042, 0.088, 0.03, M.poly, 0, 0, 0)
  for (let i = 0; i < 3; i++) box(foregrip, 0.004, 0.01, 0.032, M.dark, -0.021, 0.0 - i * 0.02 + 0.015, 0)
  const magazine = kit.pivot(group, GRIP_X, BOTTOM, 0)
  parts.mag = magazine
  parts.magDrop = 0.15
  box(magazine, 0.036, 0.155, 0.026, M.dark, 0, -0.0775, 0)
  box(magazine, 0.042, 0.01, 0.03, M.dark, 0, -0.158, 0)
}

/** The skeletal stock that folds to the right: the top bar, the bar sloping down to the butt plate, and the plate. */
function buildStock(kit: ModelKit, group: Parent): void {
  const { M, box } = kit
  const run = RECEIVER_START - 0.012
  box(group, run, 0.008, 0.016, M.metal, 0.012 + run / 2, 0.012, 0)
  const slope = Math.atan2(0.05, run)
  box(group, Math.hypot(run, 0.05), 0.008, 0.016, M.metal, 0.012 + run / 2, -0.012, 0, slope)
  box(group, 0.012, 0.085, 0.034, M.dark, 0.006, -0.025, 0)
}

/** The MP9: compact block receiver, the grip with the magazine in it, a vertical foregrip, the top rail and a stock that folds to the right. */
export function buildMp9(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 523) / 1000
  const parts: ModelParts = { family: 'rifle', glow: [] }
  buildReceiver(kit, group, parts)
  buildMuzzle(kit, group, parts, length)
  buildLower(kit, group, parts)
  parts.stockMeshes = captured(group, () => buildStock(kit, group))
  parts.frames = {
    length,
    barrelY: 0.002,
    barrelRadius: 0.0085,
    receiverStart: RECEIVER_START,
    receiverEnd: 0.4,
    receiverHeight: RECEIVER_HEIGHT,
    receiverWidth: RECEIVER_WIDTH,
    handguardEnd: RECEIVER_END,
    magazineX: GRIP_X,
    gripX: GRIP_X,
    hasRail: true,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0.002, 0)
  parts.eject = kit.mark(group, 0.335, 0.006, RECEIVER_WIDTH / 2 + 0.006)
  parts.loadPort = kit.mark(group, GRIP_X, BOTTOM - 0.004, 0)
  parts.topLoad = kit.mark(group, 0.335, TOP + 0.004, 0)
  return { group, parts }
}
