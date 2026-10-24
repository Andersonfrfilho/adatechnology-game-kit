import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

/** Port of the gallery's `shotgunBreak`: the double barrel, hinged at the action so that it opens to reload. */
export function buildBreakAction(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX, sphere } = kit
  const group = kit.group()
  const L = (options.L ?? 0) / 1000
  const barrel = (options.B ?? 0) / 1000
  const parts: ModelParts = { family: 'break', kick: 1.6, glow: [] }
  box(group, 0.09, 0.05, 0.042, M.steel, L - barrel - 0.04, -0.005, 0)
  for (let i = 0; i < 4; i++) box(group, 0.05, 0.002, 0.043, M.dark, L - barrel - 0.04, 0.01 - i * 0.008, 0)
  const barrels = kit.pivot(group, L - barrel, -0.01, 0)
  parts.barrels = barrels
  heatify(parts.glow, cylinderX(barrels, 0.0105, barrel, M.steel, barrel / 2, 0.01, 0.011, 18))
  heatify(parts.glow, cylinderX(barrels, 0.0105, barrel, M.steel, barrel / 2, 0.01, -0.011, 18))
  box(barrels, barrel, 0.004, 0.008, M.metal, barrel / 2, 0.022, 0)
  sphere(barrels, 0.002, M.white, barrel - 0.01, 0.026, 0, 1)
  cylinderX(barrels, 0.0075, 0.004, M.hole, barrel + 0.001, 0.01, 0.011, 12)
  cylinderX(barrels, 0.0075, 0.004, M.hole, barrel + 0.001, 0.01, -0.011, 12)
  box(barrels, 0.22, 0.03, 0.038, M.wood, 0.12, -0.01, 0)
  parts.breech = [kit.mark(barrels, 0.004, 0.01, 0.011), kit.mark(barrels, 0.004, 0.01, -0.011)]
  box(group, 0.12, 0.042, 0.032, M.wood, L - barrel - 0.14, -0.022, 0, 0.14)
  box(group, 0.28, 0.07, 0.036, M.wood, 0.15, -0.05, 0, 0.08)
  box(group, 0.012, 0.13, 0.04, M.rubber, 0.006, -0.06, 0)
  box(group, 0.004, 0.014, 0.004, M.dark, L - barrel - 0.05, -0.04, 0)
  parts.trigger = box(group, 0.004, 0.014, 0.004, M.dark, L - barrel - 0.035, -0.04, 0)
  box(group, 0.04, 0.004, 0.01, M.steel, L - barrel - 0.045, -0.05, 0)
  box(group, 0.012, 0.016, 0.006, M.dark, L - barrel - 0.08, 0.022, 0.012, 0.5)
  box(group, 0.012, 0.016, 0.006, M.dark, L - barrel - 0.08, 0.022, -0.012, 0.5)
  parts.safety = box(group, 0.02, 0.006, 0.008, M.steel, L - barrel - 0.07, 0.025, 0)
  parts.muzzle = kit.mark(barrels, barrel + 0.01, 0.01, 0)
  parts.eject = parts.breech[0]
  return { group, parts }
}
