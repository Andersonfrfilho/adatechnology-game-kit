import { recordFitting } from './capture'
import { buildBeltBox } from './attachments/belt-box'
import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The MG42 as the reference photo shows it: metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel.

const RECEIVER_START = 0.22
const RECEIVER_END = 0.57
const SHROUD_END = 1.12
const SHROUD_HEIGHT = 0.078
const GRIP_X = 0.33
const FEED_X = 0.42

/** The black butt with its hump, and the pistol grip leaning back under the receiver. */
function buildStock(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  box(group, 0.25, 0.075, 0.05, M.poly, 0.125, -0.014, 0, -0.05)
  box(group, 0.048, 0.13, 0.052, M.poly, 0.026, -0.03, 0)
  box(group, 0.012, 0.12, 0.054, M.rubber, 0.006, -0.03, 0)
  const grip = kit.pivot(group, GRIP_X, -0.085, 0)
  grip.rotation.z = -0.3
  parts.grip = grip
  box(grip, 0.036, 0.11, 0.032, M.poly, 0, 0, 0)
  for (let i = 0; i < 4; i++) box(grip, 0.004, 0.012, 0.034, M.dark, 0.019, 0.032 - i * 0.02, 0)
  box(group, 0.075, 0.005, 0.012, M.metal, 0.37, -0.073, 0)
  box(group, 0.005, 0.03, 0.012, M.metal, 0.405, -0.058, 0)
  parts.trigger = box(group, 0.004, 0.018, 0.006, M.dark, 0.365, -0.058, 0, 0.15)
}

/** The pressed receiver, the hinged feed cover with the rear sight, the belt feed tray on the left, the belt box and the charging handle on the right. */
function buildReceiver(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  const length = RECEIVER_END - RECEIVER_START
  box(group, length, 0.09, 0.06, M.metal, RECEIVER_START + length / 2, -0.01, 0)
  box(group, 0.3, 0.008, 0.062, M.dark, RECEIVER_START + length / 2 - 0.02, -0.04, 0)
  const cover = kit.pivot(group, FEED_X - 0.075, 0.035, 0)
  parts.cover = cover
  box(cover, 0.15, 0.022, 0.07, M.metal, 0.075, 0.011, 0)
  box(cover, 0.03, 0.024, 0.012, M.dark, 0.1, 0.028, 0)
  box(cover, 0.016, 0.03, 0.01, M.steelL, 0.04, 0.03, 0, -0.3)
  box(group, 0.12, 0.04, 0.032, M.dark, FEED_X, 0.0, -0.05)
  box(group, 0.1, 0.012, 0.012, M.metal, FEED_X, -0.03, -0.062)
  const belt = kit.pivot(group, FEED_X - 0.01, -0.105, -0.07)
  parts.belt = belt
  buildBeltBox(kit, belt)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.09
  box(bolt, 0.044, 0.012, 0.006, M.steelL, 0.5, -0.03, 0.0325)
  box(bolt, 0.012, 0.012, 0.03, M.metal, 0.5, -0.026, 0.045)
  kit.sphere(bolt, 0.0065, M.metal, 0.5, -0.026, 0.063, 1)
}

/** The perforated barrel shroud with the big barrel-change opening on the right, the barrel inside it and the conical muzzle booster with its collar. */
function buildShroud(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  const shroudLength = SHROUD_END - RECEIVER_END
  heatify(parts.glow, cylinderX(group, 0.0098, length - RECEIVER_END, M.metal, (length + RECEIVER_END) / 2, 0, 0, 16))
  box(group, shroudLength, SHROUD_HEIGHT, 0.07, M.metal, RECEIVER_END + shroudLength / 2, 0, 0)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) box(group, 0.034, 0.018, 0.004, M.hole, 0.74 + i * 0.056, 0.001, side * 0.0352)
  }
  box(group, 0.1, 0.044, 0.004, M.hole, 0.64, 0, 0.0352)
  cylinderX(group, 0.0305, 0.014, M.dark, SHROUD_END + 0.007, 0, 0, 20)
  for (let i = 0; i < 4; i++) cylinderX(group, 0.0345, 0.006, M.dark, SHROUD_END + 0.022 + i * 0.01, 0, 0, 20)
  cylinderX(group, 0.0225, length - SHROUD_END - 0.02, M.dark, (length + SHROUD_END + 0.02) / 2, 0, 0, 20, 0.0315)
  cylinderX(group, 0.0235, 0.004, M.hole, length + 0.0005, 0, 0, 16)
  box(group, 0.01, 0.036, 0.008, M.dark, 1.045, 0.052, 0)
}

/** The bipod at the front of the shroud, its two legs splayed forward. */
function buildBipod(kit: ModelKit, group: Parent): void {
  const { M, box, cylinderX } = kit
  cylinderX(group, 0.011, 0.04, M.dark, 1.0, -SHROUD_HEIGHT / 2 - 0.01, 0, 12)
  for (const side of [-1, 1]) {
    const leg = kit.pivot(group, 1.0, -SHROUD_HEIGHT / 2 - 0.01, side * 0.015)
    leg.rotation.set(side * 0.2, 0, 0.35 + (side > 0 ? 0.25 : 0))
    box(leg, 0.008, 0.26, 0.008, M.dark, 0, -0.13, 0)
    box(leg, 0.03, 0.01, 0.014, M.dark, 0.012, -0.26, 0)
  }
}

/** The MG42: perforated shroud with the barrel-change opening, muzzle booster, front bipod, belt feed on the left, butt and pistol grip. */
export function buildMg42(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 1220) / 1000
  const parts: ModelParts = { family: 'belt', glow: [] }
  buildStock(kit, group, parts)
  buildReceiver(kit, group, parts)
  buildShroud(kit, group, parts, length)
  recordFitting(parts, 'bipod', group, () => buildBipod(kit, group))
  parts.mag = null
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: 0.0098,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: 0.09,
    receiverWidth: 0.06,
    handguardEnd: 0.96,
    magazineX: FEED_X,
    gripX: GRIP_X,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.5, -0.03, 0.034)
  parts.loadPort = kit.mark(group, FEED_X, 0.04, 0)
  parts.topLoad = kit.mark(group, FEED_X, 0.05, 0)
  return { group, parts }
}
