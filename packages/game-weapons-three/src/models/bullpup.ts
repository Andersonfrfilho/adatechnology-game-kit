import type { ModelKit } from './kit'
import { heatify } from './kit'
import { rail, scope } from './details'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

/** Port of the gallery's `bullpup`: the rifle (AUG) or, with `shot`, the twin-tube pump shotgun (KSG). */
export function buildBullpup(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX } = kit
  const group = kit.group()
  const L = (options.L ?? 0) / 1000
  const barrel = (options.B ?? 0) / 1000
  const bodyLength = Math.max(0.32, L - barrel * 0.72)
  const body = options.shot ? M.poly : M.olive
  const parts: ModelParts = { family: options.shot ? 'pump' : 'rifle', stroke: 0.06, glow: [] }
  box(group, bodyLength, 0.075, 0.042, body, bodyLength / 2, 0, 0)
  box(group, bodyLength * 0.9, 0.02, 0.044, M.dark, bodyLength * 0.5, -0.02, 0)
  box(group, 0.032, 0.13, 0.044, M.rubber, 0.016, -0.025, 0)
  const gx = bodyLength * 0.8
  const grip = kit.pivot(group, gx, -0.085, 0)
  grip.rotation.z = -0.25
  parts.grip = grip
  box(grip, 0.03, 0.1, 0.03, M.poly, 0, 0, 0)
  box(group, 0.1, 0.006, 0.03, body, gx + 0.01, -0.06, 0)
  parts.trigger = box(group, 0.004, 0.016, 0.004, M.dark, gx + 0.02, -0.05, 0, 0.15)
  heatify(parts.glow, cylinderX(group, options.shot ? 0.0105 : 0.0085, barrel, M.metal, L - barrel / 2, 0.012, 0, 16))
  cylinderX(group, 0.006, 0.004, M.hole, L + 0.001, 0.012, 0, 12)
  box(group, 0.05, 0.024, 0.004, M.hole, bodyLength * 0.25, 0.005, 0.0212)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(bolt, 0.044, 0.02, 0.006, M.steelL, bodyLength * 0.25, 0.005, 0.02)
  if (options.shot) {
    cylinderX(group, 0.012, bodyLength * 0.75, M.metal, bodyLength * 0.55, -0.025, 0.014, 14)
    cylinderX(group, 0.012, bodyLength * 0.75, M.metal, bodyLength * 0.55, -0.025, -0.014, 14)
    const pump = kit.pivot(group)
    parts.pump = pump
    box(pump, 0.15, 0.045, 0.052, M.poly, bodyLength + 0.06, -0.015, 0)
    for (let i = 0; i < 6; i++) box(pump, 0.006, 0.047, 0.054, M.dark, bodyLength + 0.005 + i * 0.022, -0.015, 0)
    rail(kit, group, bodyLength * 0.15, bodyLength * 0.8, 0.04, 0, 0.02)
    parts.loadPort = kit.mark(group, bodyLength * 0.2, -0.04, 0)
  } else {
    const magazine = kit.pivot(group, gx - 0.11, -0.03, 0)
    magazine.rotation.z = 0.14
    parts.mag = magazine
    box(magazine, 0.05, 0.14, 0.026, M.glass, 0, -0.07, 0)
    for (let i = 0; i < 6; i++) cylinderX(magazine, 0.003, 0.04, M.brass, 0, -0.01 - i * 0.02, 0, 6)
    parts.magDrop = 0.18
    scope(kit, group, 2, bodyLength * 0.5, 0.04, 0)
    box(group, 0.2, 0.03, 0.02, body, bodyLength * 0.62, 0.048, 0)
    box(group, 0.026, 0.075, 0.026, body, bodyLength + 0.05, -0.05, 0, 0.1)
  }
  parts.muzzle = kit.mark(group, L + 0.01, 0.012, 0)
  parts.eject = kit.mark(group, bodyLength * 0.25, 0.005, 0.03)
  return { group, parts }
}
