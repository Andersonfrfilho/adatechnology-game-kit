import type { Group } from 'three'
import type { ModelKit } from './kit'
import { heatify } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

const PI = Math.PI
const CHAMBERS = 6

/** The barrel of the Python: round barrel, the ventilated rib along the top and the underlug that runs to the muzzle over the ejector rod. */
function buildPythonBarrel(kit: ModelKit, parts: ModelParts, group: Group, barrel: number): void {
  const { M, box, cylinderX } = kit
  const start = 0.112
  heatify(parts.glow, cylinderX(group, 0.0096, barrel, M.metal, start + barrel / 2, 0.009, 0, 20))
  box(group, barrel * 0.98, 0.0175, 0.0195, M.metal, start + barrel * 0.49, -0.007, 0)
  box(group, barrel * 0.96, 0.0058, 0.0088, M.metal, start + barrel * 0.48, 0.0218, 0)
  for (let i = 0; i < 2; i++) box(group, barrel * 0.2, 0.0062, 0.0092, M.hole, start + barrel * (0.26 + i * 0.36), 0.0218, 0)
  box(group, 0.012, 0.0036, 0.004, M.dark, start + barrel * 0.4, -0.004, 0.0094)
  box(group, 0.009, 0.01, 0.0034, M.metal, start + barrel - 0.007, 0.0285, 0, -0.35)
  box(group, 0.0035, 0.005, 0.0036, M.red, start + barrel - 0.0045, 0.0288, 0, -0.35)
  cylinderX(group, 0.0042, 0.005, M.hole, start + barrel + 0.0015, 0.009, 0, 12)
}

/** The grip of walnut with its checkering, the brass medallion and the flared butt. */
function buildPythonGrip(kit: ModelKit, parts: ModelParts, group: Group): void {
  const { M, box, cylinderZ } = kit
  const grip = kit.pivot(group, 0.0, -0.05, 0)
  grip.rotation.z = -0.4
  parts.grip = grip
  kit.roundness = 0.3
  box(grip, 0.052, 0.08, 0.033, M.wood, 0.0, 0.014, 0)
  box(grip, 0.05, 0.07, 0.034, M.wood, -0.006, -0.036, 0)
  kit.roundness = null
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) box(grip, 0.0045, 0.0045, 0.0012, M.woodL, -0.022 + j * 0.0075, -0.068 + i * 0.0105, side * 0.0172, 0, 0, 0.785)
    cylinderZ(grip, 0.0048, 0.0014, M.brass, 0.006, 0.026, side * 0.0172, 14)
    cylinderZ(grip, 0.0014, 0.0012, M.steel, -0.01, -0.004, side * 0.0172, 8)
  }
  box(grip, 0.05, 0.004, 0.036, M.metal, -0.006, -0.073, 0)
  box(grip, 0.006, 0.07, 0.025, M.metal, 0.0265, 0.0, 0)
}

/** Colt Python: blued frame with the adjustable rear sight, the long hammer spur, round trigger guard, the swing-out cylinder and the pieces of `buildPythonBarrel` and `buildPythonGrip`. */
export function buildPythonRevolver(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box, cylinderX } = kit
  const group = kit.group()
  const parts: ModelParts = { family: 'revolver', kick: 0.9, glow: [] }
  const barrel = (options.B ?? 0) / 1000
  const chambers = options.chambers ?? CHAMBERS
  kit.roundness = 0.12
  box(group, 0.085, 0.056, 0.026, M.metal, 0.07, -0.004, 0)
  kit.roundness = null
  box(group, 0.056, 0.008, 0.02, M.metal, 0.075, 0.025, 0)
  box(group, 0.016, 0.01, 0.016, M.metal, 0.044, 0.034, 0)
  box(group, 0.004, 0.008, 0.012, M.dark, 0.044, 0.04, 0)
  box(group, 0.024, 0.012, 0.004, M.dark, 0.055, 0.004, -0.013)
  box(group, 0.016, 0.018, 0.0255, M.metal, 0.099, -0.014, 0)
  const crane = kit.pivot(group, 0.077, -0.026, 0)
  parts.crane = crane
  const cylinder = kit.pivot(crane, 0, 0.024, 0)
  parts.cylinder = cylinder
  cylinderX(cylinder, 0.0245, 0.05, M.metal, 0, 0, 0, 28)
  for (let i = 0; i < chambers; i++) {
    const angle = (i * 2 * PI) / chambers
    box(cylinder, 0.03, 0.006, 0.006, M.dark, 0.004, Math.cos(angle) * 0.0242, Math.sin(angle) * 0.0242, 0, 0, angle)
  }
  parts.chambers = []
  for (let i = 0; i < chambers; i++) {
    const angle = (i * 2 * PI) / chambers + PI / chambers
    parts.chambers.push(kit.mark(cylinder, -0.024, Math.cos(angle) * 0.013, Math.sin(angle) * 0.013))
    cylinderX(cylinder, 0.0046, 0.002, M.brass, -0.0235, Math.cos(angle) * 0.013, Math.sin(angle) * 0.013, 12)
  }
  buildPythonBarrel(kit, parts, group, barrel)
  const hammer = kit.pivot(group, 0.034, 0.02, 0)
  parts.hammer = hammer
  box(hammer, 0.013, 0.03, 0.01, M.metal, -0.008, 0.012, 0, 0.55)
  box(hammer, 0.014, 0.006, 0.011, M.dark, -0.017, 0.024, 0, 0.55)
  buildPythonGrip(kit, parts, group)
  const guard = kit.torus(group, new kit.THREE.TorusGeometry(0.018, 0.0022, 8, 28), M.metal, 0.063, -0.04, 0)
  guard.scale.set(1.12, 1, 1)
  parts.trigger = box(group, 0.004, 0.02, 0.005, M.steel, 0.063, -0.036, 0, 0.35)
  parts.muzzle = kit.mark(group, 0.112 + barrel + 0.006, 0.009, 0)
  parts.eject = kit.mark(group, 0.077, 0, 0)
  return { group, parts }
}
