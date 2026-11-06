import { captured } from './capture'
import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The MP40 as the reference photo shows it (assets/weapon-references.json): metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the barrel.

const TUBE_RADIUS = 0.0205
const RECEIVER_START = 0.25
const RECEIVER_END = 0.604
const WELL_X = 0.562
const GRIP_X = 0.28

/** The tubular receiver with its rear cap, the rear sight, the ejection port, the bolt and the charging handle on the right. */
function buildReceiver(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  const length = RECEIVER_END - RECEIVER_START
  cylinderX(group, TUBE_RADIUS, length, M.metal, RECEIVER_START + length / 2, 0, 0, 24)
  cylinderX(group, TUBE_RADIUS + 0.002, 0.032, M.metal, RECEIVER_START + 0.016, 0, 0, 24)
  cylinderX(group, TUBE_RADIUS + 0.002, 0.012, M.metal, RECEIVER_END - 0.006, 0, 0, 24)
  box(group, 0.006, 0.026, 0.004, M.hole, RECEIVER_START + 0.014, 0, TUBE_RADIUS + 0.002)
  box(group, 0.03, 0.02, 0.054, M.metal, RECEIVER_START + 0.015, -0.032, 0)
  box(group, 0.03, 0.004, 0.02, M.metal, 0.42, TUBE_RADIUS + 0.001, 0)
  box(group, 0.008, 0.014, 0.008, M.dark, 0.42, TUBE_RADIUS + 0.008, 0)
  box(group, 0.05, 0.012, 0.004, M.hole, 0.33, 0.012, 0.0166)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  parts.stroke = 0.08
  box(bolt, 0.044, 0.01, 0.006, M.steelL, 0.33, 0.012, 0.0172)
  box(bolt, 0.012, 0.012, 0.016, M.metal, 0.4, 0.002, TUBE_RADIUS + 0.008)
  kit.sphere(bolt, 0.007, M.metal, 0.4, 0.002, TUBE_RADIUS + 0.02, 1)
}

/** The barrel nut, the ribbed barrel, the sleeve at the muzzle with the hooded front sight, and the rest bar under it. */
function buildBarrel(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  cylinderX(group, 0.0185, 0.056, M.metal, RECEIVER_END + 0.028, 0, 0, 20)
  heatify(parts.glow, cylinderX(group, 0.0105, length - RECEIVER_END - 0.03, M.metal, (length + RECEIVER_END + 0.03) / 2, 0, 0, 16))
  for (let i = 0; i < 9; i++) cylinderX(group, 0.0122, 0.003, M.dark, 0.675 + i * 0.0125, 0, 0, 16)
  cylinderX(group, 0.0118, 0.034, M.dark, length - 0.017, 0, 0, 16)
  cylinderX(group, 0.0055, 0.004, M.hole, length + 0.0005, 0, 0, 12)
  box(group, 0.012, 0.026, 0.012, M.dark, length - 0.02, 0.026, 0)
  box(group, 0.012, 0.01, 0.026, M.dark, length - 0.02, 0.015, 0)
  box(group, 0.1, 0.004, 0.012, M.metal, length - 0.1, -0.0135, 0)
  box(group, 0.006, 0.022, 0.012, M.metal, length - 0.065, -0.02, 0)
}

/** The Bakelite housing under the receiver, with the ribbed pad, the trigger guard, the trigger and the pistol grip leaning back. */
function buildLower(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  box(group, 0.25, 0.04, 0.04, M.bakelite, 0.388, -0.021, 0, -0.1)
  for (let i = 0; i < 6; i++) box(group, 0.003, 0.006, 0.034, M.dark, 0.42 + i * 0.015, -0.047 + i * 0.0015, 0, -0.1)
  box(group, 0.006, 0.05, 0.012, M.metal, 0.362, -0.064, 0)
  box(group, 0.07, 0.007, 0.012, M.metal, 0.33, -0.09, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.006, M.dark, 0.33, -0.058, 0, 0.15)
  const grip = kit.pivot(group, GRIP_X, -0.085, 0)
  grip.rotation.z = -0.5
  parts.grip = grip
  box(grip, 0.036, 0.135, 0.03, M.poly, 0, 0, 0)
  for (let i = 0; i < 5; i++) box(grip, 0.004, 0.012, 0.032, M.dark, 0.019, 0.04 - i * 0.02, 0)
}

/** The magazine well stamped under the front of the receiver and the straight magazine in it. */
function buildMagazine(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box } = kit
  box(group, 0.084, 0.058, 0.036, M.metal, WELL_X, -0.041, 0)
  for (const x of [-0.03, 0, 0.03]) box(group, 0.003, 0.05, 0.038, M.dark, WELL_X + x, -0.041, 0)
  const magazine = kit.pivot(group, WELL_X, -0.039, 0)
  parts.mag = magazine
  parts.magDrop = 0.19
  box(magazine, 0.036, 0.19, 0.022, M.metal, 0, -0.095, 0)
  for (const x of [-0.007, 0.007]) box(magazine, 0.003, 0.15, 0.0235, M.dark, x, -0.12, 0)
  box(magazine, 0.04, 0.008, 0.026, M.dark, 0, -0.19, 0)
}

/** The folding stock: two bars from the hinge under the rear cap, sloping down to the butt plate. */
function buildStock(kit: ModelKit, group: Parent): void {
  const { M, box } = kit
  const run = RECEIVER_START - 0.012
  for (const side of [-1, 1]) box(group, run, 0.007, 0.007, M.metal, 0.012 + run / 2, -0.047, side * 0.0235, 0.07)
  box(group, 0.012, 0.11, 0.054, M.metal, 0.006, -0.055, 0)
  box(group, 0.004, 0.09, 0.044, M.hole, 0.013, -0.055, 0)
}

/** The MP40: tubular receiver, magazine well, Bakelite housing, grip and the underfolding stock. */
export function buildMp40(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 833) / 1000
  const parts: ModelParts = { family: 'rifle', glow: [] }
  buildReceiver(kit, group, parts)
  buildBarrel(kit, group, parts, length)
  buildLower(kit, group, parts)
  buildMagazine(kit, group, parts)
  parts.stockMeshes = captured(group, () => buildStock(kit, group))
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: 0.0105,
    receiverStart: RECEIVER_START,
    receiverEnd: 0.52,
    receiverHeight: 0.078,
    receiverWidth: 0.04,
    handguardEnd: RECEIVER_END,
    magazineX: WELL_X,
    gripX: GRIP_X,
    hasRail: false,
  }
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
  parts.eject = kit.mark(group, 0.33, 0.012, 0.0215)
  parts.loadPort = kit.mark(group, WELL_X, -0.02, 0)
  parts.topLoad = kit.mark(group, 0.33, TUBE_RADIUS + 0.004, 0)
  return { group, parts }
}
