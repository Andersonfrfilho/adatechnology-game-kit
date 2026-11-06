import { captured } from './capture'
import { heatify } from './kit'
import type { ModelKit, Parent } from './kit'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

// The Milkor MGL (the M32) as the reference photo shows it (assets/weapon-references.json): metres in the model's frame, x from the butt to the muzzle, y up, z to the right, y 0 on the axis of the bore.

const CHAMBERS = 6
const BARREL_RADIUS = 0.0215
const CYLINDER_X = 0.427
const CYLINDER_Y = -0.04
const CYLINDER_RADIUS = 0.066
const CYLINDER_LENGTH = 0.1
const HINGE_X = 0.323
const HINGE_Y = 0.046
const FORE_GRIP_X = 0.615
const GRIP_X = 0.277
const GRIP_Y = -0.052

/** The short rifled barrel in its sleeve, the collar where it meets the frame, and the rounded muzzle. */
function buildBarrel(kit: ModelKit, group: Parent, parts: ModelParts, length: number): void {
  const { M, box, cylinderX } = kit
  heatify(parts.glow, cylinderX(group, BARREL_RADIUS, length - 0.636, M.metal, (length + 0.636) / 2, 0, 0, 24))
  cylinderX(group, 0.0245, 0.09, M.metal, 0.591, 0, 0, 24)
  cylinderX(group, 0.0275, 0.056, M.dark, 0.518, 0, 0, 24)
  cylinderX(group, 0.0232, 0.004, M.hole, length - 0.0005, 0, 0, 24)
  box(group, 0.012, 0.01, 0.012, M.dark, length - 0.03, 0.026, 0)
}

/** The swing-out cylinder: a crane the reload opens, the cylinder that turns a sixth with each shot, the flanges and the six chambers. */
function buildCylinder(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  const crane = kit.pivot(group, CYLINDER_X, CYLINDER_Y - CYLINDER_RADIUS, 0)
  parts.crane = crane
  const cylinder = kit.pivot(crane, 0, CYLINDER_RADIUS, 0)
  parts.cylinder = cylinder
  const half = CYLINDER_LENGTH / 2
  cylinderX(cylinder, CYLINDER_RADIUS, CYLINDER_LENGTH, M.metal, 0, 0, 0, 36)
  cylinderX(cylinder, CYLINDER_RADIUS + 0.007, 0.012, M.metal, half - 0.004, 0, 0, 36)
  cylinderX(cylinder, CYLINDER_RADIUS + 0.004, 0.01, M.dark, -half + 0.005, 0, 0, 36)
  cylinderX(cylinder, 0.012, CYLINDER_LENGTH + 0.016, M.steel, -0.004, 0, 0, 16)
  parts.chambers = []
  for (let i = 0; i < CHAMBERS; i++) {
    const angle = (i * 2 * Math.PI) / CHAMBERS + Math.PI / CHAMBERS
    const y = Math.cos(angle) * 0.0445
    const z = Math.sin(angle) * 0.0445
    cylinderX(cylinder, 0.0215, 0.003, M.hole, -half - 0.0005, y, z, 20)
    cylinderX(cylinder, 0.0215, 0.003, M.hole, half + 0.0025, y, z, 20)
    parts.chambers.push(kit.mark(cylinder, -half - 0.002, y, z))
  }
  for (let i = 0; i < CHAMBERS; i++) {
    const angle = (i * 2 * Math.PI) / CHAMBERS
    box(cylinder, 0.05, 0.004, 0.006, M.dark, 0, Math.cos(angle) * (CYLINDER_RADIUS + 0.0005), Math.sin(angle) * (CYLINDER_RADIUS + 0.0005), 0, 0, angle)
  }
  box(group, 0.016, 0.018, 0.034, M.steel, CYLINDER_X + half + 0.008, CYLINDER_Y - CYLINDER_RADIUS + 0.012, 0)
}

/** The frame behind the cylinder, the top rail that carries the collimator sight, the trigger group and the hammer. */
function buildFrame(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderX } = kit
  box(group, 0.13, 0.092, 0.03, M.metal, 0.305, -0.016, 0)
  box(group, 0.07, 0.03, 0.044, M.dark, 0.28, 0.034, 0)
  box(group, 0.17, 0.03, 0.04, M.metal, 0.413, 0.04, 0)
  for (let i = 0; i < 7; i++) box(group, 0.008, 0.006, 0.042, M.dark, 0.34 + i * 0.022, 0.056, 0)
  cylinderX(group, 0.011, 0.14, M.steel, 0.392, 0.042, 0, 14)
  box(group, 0.07, 0.044, 0.038, M.dark, 0.405, 0.085, 0)
  cylinderX(group, 0.0155, 0.07, M.dark, 0.408, 0.088, 0, 16)
  cylinderX(group, 0.0125, 0.006, M.lens, 0.446, 0.088, 0, 16)
  box(group, 0.014, 0.01, 0.014, M.steel, 0.37, 0.06, 0.016)
  box(group, 0.07, 0.006, 0.016, M.metal, 0.346, -0.075, 0)
  box(group, 0.006, 0.026, 0.016, M.metal, 0.38, -0.06, 0)
  parts.trigger = box(group, 0.005, 0.02, 0.006, M.dark, 0.35, -0.052, 0, 0.2)
  const hammer = kit.pivot(group, 0.26, 0.028, 0)
  box(hammer, 0.012, 0.02, 0.01, M.dark, -0.004, 0.008, 0, 0.4)
  parts.hammer = hammer
}

/** The pistol grip behind the frame and the vertical grip under the barrel, where the other hand takes the weapon. */
function buildGrips(kit: ModelKit, group: Parent, parts: ModelParts): void {
  const { M, box, cylinderY } = kit
  const grip = kit.pivot(group, GRIP_X, GRIP_Y, 0)
  grip.rotation.z = -0.3
  parts.grip = grip
  box(grip, 0.04, 0.1, 0.034, M.poly, 0, -0.01, 0)
  box(grip, 0.044, 0.01, 0.036, M.dark, 0, -0.062, 0)
  const foreGrip = kit.pivot(group, FORE_GRIP_X, -0.075, 0)
  parts.foreGrip = foreGrip
  box(foreGrip, 0.03, 0.1, 0.028, M.poly, 0, 0, 0)
  for (let i = 0; i < 3; i++) box(foreGrip, 0.032, 0.004, 0.03, M.dark, 0, -0.025 - i * 0.012, 0)
  cylinderY(group, 0.017, 0.016, M.metal, FORE_GRIP_X, -0.03, 0, 14)
}

/** The wire stock: the strut from the hinge on the top rail back to the flared butt plate. */
function buildStock(kit: ModelKit, group: Parent): void {
  const { M, box } = kit
  const run = HINGE_X - 0.012
  box(group, run, 0.014, 0.028, M.metal, 0.012 + run / 2, 0.062, 0, -0.153)
  box(group, 0.014, 0.12, 0.06, M.metal, 0.007, 0.062, 0)
  box(group, 0.006, 0.1, 0.05, M.rubber, 0.002, 0.062, 0)
  box(group, 0.03, 0.034, 0.036, M.dark, HINGE_X - 0.015, HINGE_Y, 0)
}

/** The Milkor MGL (the M32 of the US Marine Corps): six-chamber swing-out cylinder, short barrel with its front grip, collimator sight on the rail, pistol grip and folding stock. */
export function buildMgl(kit: ModelKit, options: ModelOptions): BuiltModel {
  const group = kit.group()
  const length = (options.L ?? 778) / 1000
  const parts: ModelParts = { family: 'cylinder', kick: 1.2, glow: [] }
  buildBarrel(kit, group, parts, length)
  buildCylinder(kit, group, parts)
  buildFrame(kit, group, parts)
  buildGrips(kit, group, parts)
  parts.stockMeshes = captured(group, () => buildStock(kit, group))
  parts.frames = {
    length,
    barrelY: 0,
    barrelRadius: BARREL_RADIUS,
    receiverStart: HINGE_X,
    receiverEnd: 0.5,
    receiverHeight: HINGE_Y * 2,
    receiverWidth: 0.044,
    handguardEnd: 0.69,
    magazineX: CYLINDER_X,
    gripX: GRIP_X,
    hasRail: true,
  }
  parts.muzzle = kit.mark(group, length + 0.006, 0, 0)
  parts.eject = kit.mark(group, CYLINDER_X, CYLINDER_Y, 0)
  return { group, parts }
}
