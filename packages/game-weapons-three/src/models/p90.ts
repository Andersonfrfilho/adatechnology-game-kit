import type { ModelKit } from './kit'
import { heatify } from './kit'
import { scope } from './details'
import type { BuiltModel, ModelParts } from './types'

/** Port of the gallery's `p90`: the bullpup with the horizontal magazine on top. */
export function buildP90(kit: ModelKit): BuiltModel {
  const { M, box, cylinderX } = kit
  const group = kit.group()
  const parts: ModelParts = { family: 'p90', stroke: 0.04, kick: 0.6, glow: [] }
  box(group, 0.4, 0.07, 0.055, M.poly, 0.2, 0, 0)
  box(group, 0.12, 0.075, 0.05, M.poly, 0.2, -0.07, 0)
  box(group, 0.08, 0.04, 0.03, M.hole, 0.21, -0.06, 0)
  box(group, 0.06, 0.13, 0.056, M.poly, 0.03, -0.03, 0)
  box(group, 0.05, 0.03, 0.056, M.poly, 0.33, -0.04, 0)
  heatify(parts.glow, cylinderX(group, 0.008, 0.09, M.metal, 0.43, 0, 0, 16))
  const magazine = kit.pivot(group, 0.22, 0.047, 0)
  parts.mag = magazine
  parts.magDir = 1
  parts.magDrop = 0.08
  box(magazine, 0.3, 0.022, 0.05, M.glass, 0, 0, 0)
  for (let i = 0; i < 12; i++) cylinderX(magazine, 0.0028, 0.02, M.brass, -0.12 + i * 0.022, 0, 0, 6)
  scope(kit, group, 1, 0.24, 0.06, 0)
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(bolt, 0.02, 0.012, 0.012, M.dark, 0.3, 0.02, 0.03)
  parts.trigger = box(group, 0.004, 0.016, 0.004, M.dark, 0.24, -0.045, 0)
  parts.muzzle = kit.mark(group, 0.48, 0, 0)
  parts.eject = kit.mark(group, 0.2, -0.07, 0)
  return { group, parts }
}
