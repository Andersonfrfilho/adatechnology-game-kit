import { heatify } from './kit'
import type { ModelKit } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The Winchester 1887 as the reference photo shows it: metres in the model's frame, x from the butt to the muzzle, y up, z to the right, the barrel on y = 0.

const RECEIVER_START = 0.333
const RECEIVER_END = 0.487
const RECEIVER_HEIGHT = 0.1
const FOREND_END = 0.783

/** Lever-action shotgun: the tall blued receiver over the big lever loop, a thick barrel with the magazine tube under it, wood forend and one-piece wood stock. */
export function buildLeverShotgun(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX, sphere, cylinderZ } = kit
  const group = kit.group()
  const length = (options.L ?? 0) / 1000
  const parts: ModelParts = { family: 'lever', glow: [] }
  const radius = options.br ?? 0.012
  const middle = (RECEIVER_START + RECEIVER_END) / 2
  const barrelLength = length - RECEIVER_END
  heatify(parts.glow, cylinderX(group, radius, barrelLength, M.metal, RECEIVER_END + barrelLength / 2, 0, 0, 20))
  cylinderX(group, radius * 0.55, 0.004, M.hole, length + 0.0005, 0, 0, 12)
  sphere(group, 0.0028, M.white, length - 0.012, radius + 0.002, 0, 1)
  const tubeLength = 0.61
  cylinderX(group, 0.009, tubeLength, M.metal, FOREND_END - tubeLength / 2 + 0.01, -0.04, 0, 14)
  cylinderX(group, 0.0095, 0.012, M.dark, FOREND_END - tubeLength + 0.012, -0.04, 0, 14)
  cylinderX(group, 0.0135, 0.008, M.metal, FOREND_END - tubeLength + 0.035, 0, 0, 16)
  box(group, FOREND_END - RECEIVER_END, 0.052, 0.044, M.wood, (FOREND_END + RECEIVER_END) / 2, -0.0215, 0)
  box(group, RECEIVER_END - RECEIVER_START + 0.01, RECEIVER_HEIGHT, 0.036, M.metal, middle, -0.035, 0)
  box(group, 0.1, 0.055, 0.004, M.steel, middle - 0.01, -0.03, 0.0182)
  box(group, 0.1, 0.034, 0.034, M.metal, RECEIVER_START + 0.03, 0.002, 0, -0.18)
  box(group, 0.16, 0.012, 0.036, M.steel, middle - 0.005, 0.012, 0)
  box(group, 0.012, 0.014, 0.008, M.dark, RECEIVER_END - 0.01, 0.022, 0)
  box(group, 0.07, 0.05, 0.036, M.metal, RECEIVER_START + 0.01, -0.02, 0)
  cylinderZ(group, 0.005, 0.038, M.steelL, middle - 0.02, -0.02, 0, 10)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(group, 0.05, 0.03, 0.004, M.hole, middle + 0.02, -0.015, 0.0175)
  box(bolt, 0.044, 0.018, 0.006, M.steelL, middle + 0.02, -0.015, 0.0175)
  box(group, 0.22, 0.082, 0.036, M.wood, 0.11, -0.109, 0)
  box(group, 0.2, 0.05, 0.036, M.wood, 0.11, -0.167, 0, 0.15)
  box(group, 0.165, 0.05, 0.034, M.wood, 0.2765, -0.09, 0, 0.815)
  box(group, 0.125, 0.04, 0.034, M.wood, 0.277, -0.039, 0, 0.47)
  box(group, 0.016, 0.15, 0.04, M.rubber, 0.006, -0.145, 0, 0.1)
  parts.trigger = box(group, 0.004, 0.018, 0.004, M.dark, 0.36, -0.082, 0, 0.1)
  const lever = kit.pivot(group, 0.4, -0.08, 0)
  parts.lever = lever
  box(lever, 0.018, 0.12, 0.016, M.metal, -0.015, -0.055, 0, 0.14)
  box(lever, 0.17, 0.016, 0.016, M.metal, -0.1, -0.115, 0, 0.1)
  box(lever, 0.016, 0.11, 0.016, M.metal, -0.185, -0.06, 0, -0.1)
  box(lever, 0.06, 0.016, 0.016, M.metal, -0.155, -0.002, 0, -0.2)
  box(lever, 0.05, 0.03, 0.022, M.dark, -0.14, -0.113, 0, 0.1)
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, middle + 0.02, 0.012, 0.01)
  parts.loadPort = kit.mark(group, middle + 0.03, -0.035, 0.02)
  parts.topLoad = parts.eject
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: radius,
    receiverStart: RECEIVER_START,
    receiverEnd: RECEIVER_END,
    receiverHeight: RECEIVER_HEIGHT,
    receiverWidth: 0.034,
    handguardEnd: FOREND_END,
    magazineX: middle,
    gripX: 0.3,
    hasRail: false,
  }
  return { group, parts }
}
