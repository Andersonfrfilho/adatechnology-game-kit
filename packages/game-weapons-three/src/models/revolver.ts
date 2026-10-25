import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

const PI = Math.PI
const DEFAULT_CHAMBERS = 6

/** Port of the gallery's `revolver`: frame, swing-out crane with the cylinder (six chambers, or as many as the weapon holds), barrel, hammer, grip and trigger. */
export function buildRevolver(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX } = kit
  const group = kit.group()
  const parts: ModelParts = { family: 'revolver', kick: options.cal === '.44 Magnum' ? 1.5 : 0.9, glow: [] }
  const barrel = (options.B ?? 0) / 1000
  const chambers = options.chambers ?? DEFAULT_CHAMBERS
  const metal = options.steel ? M.steel : M.metal
  box(group, 0.08, 0.044, 0.024, metal, 0.07, 0, 0)
  box(group, 0.036, 0.012, 0.022, metal, 0.096, 0.022, 0)
  box(group, 0.024, 0.012, 0.004, M.dark, 0.055, 0.006, -0.013)
  const crane = kit.pivot(group, 0.077, -0.024, 0)
  parts.crane = crane
  const cylinder = kit.pivot(crane, 0, 0.022, 0)
  parts.cylinder = cylinder
  cylinderX(cylinder, 0.0215, 0.042, metal, 0, 0, 0, 24)
  for (let i = 0; i < chambers; i++) {
    const angle = (i * 2 * PI) / chambers
    box(cylinder, 0.026, 0.005, 0.005, M.dark, 0, Math.cos(angle) * 0.0205, Math.sin(angle) * 0.0205, 0, 0, angle)
  }
  parts.chambers = []
  for (let i = 0; i < chambers; i++) {
    const angle = (i * 2 * PI) / chambers + PI / chambers
    parts.chambers.push(kit.mark(cylinder, -0.022, Math.cos(angle) * 0.013, Math.sin(angle) * 0.013))
    cylinderX(cylinder, 0.0046, 0.002, M.brass, -0.0215, Math.cos(angle) * 0.013, Math.sin(angle) * 0.013, 12)
  }
  heatify(parts.glow, cylinderX(group, 0.0088, barrel, metal, 0.112 + barrel / 2, 0.009, 0, 18))
  box(group, barrel * 0.92, 0.015, 0.013, metal, 0.112 + barrel * 0.46, -0.005, 0)
  cylinderX(group, 0.004, 0.005, M.hole, 0.112 + barrel + 0.0015, 0.009, 0, 12)
  box(group, 0.012, 0.009, 0.004, M.dark, 0.112 + barrel - 0.008, 0.021, 0, -0.3)
  box(group, 0.012, 0.006, 0.012, M.dark, 0.105, 0.031, 0)
  const hammer = kit.pivot(group, 0.036, 0.018, 0)
  box(hammer, 0.01, 0.02, 0.008, M.dark, -0.004, 0.008, 0, 0.45)
  parts.hammer = hammer
  const grip = kit.pivot(group, 0.024, -0.062, 0)
  grip.rotation.z = -0.38
  parts.grip = grip
  box(grip, 0.034, 0.1, 0.031, options.wood ? M.wood : M.rubber, 0, 0, 0)
  if (!options.wood) for (let i = 0; i < 4; i++) box(grip, 0.006, 0.07, 0.033, M.dark, -0.012 + i * 0.008, 0, 0)
  box(group, 0.038, 0.004, 0.008, metal, 0.062, -0.036, 0)
  box(group, 0.004, 0.022, 0.008, metal, 0.08, -0.026, 0, 0.2)
  parts.trigger = box(group, 0.004, 0.015, 0.004, M.dark, 0.06, -0.027, 0, 0.2)
  parts.muzzle = kit.mark(group, 0.112 + barrel + 0.006, 0.009, 0)
  parts.eject = kit.mark(group, 0.077, 0, 0)
  return { group, parts }
}
