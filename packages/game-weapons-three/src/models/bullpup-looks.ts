import { heatify } from './kit'
import type { ModelKit } from './kit'
import { rail } from './details'
import type { ModelParts } from './types'

// The three bullpups that are not the Steyr AUG, as the reference photos show them (assets/weapon-references.json): metres in the model's frame, x from the butt to the muzzle, y up, z to the right, the barrel on y = 0.

type BullpupLook = {
  readonly kit: ModelKit
  readonly group: ReturnType<ModelKit['group']>
  readonly parts: ModelParts
  readonly length: number
}

/** What the three share: the magazine behind the grip, the grip, the trigger and its guard, the bolt window and the barrel with its muzzle device. */
function addControls(look: BullpupLook, spec: { gripX: number; gripY: number; gripLean: number; magX: number; magTop: number; magTilt: number; magSize: readonly [number, number, number]; magMaterial: 'polyMag' | 'worn'; gripMaterial: 'poly' | 'olive'; triggerX: number; ejectX: number }): void {
  const { kit, group, parts } = look
  const { M, box } = kit
  const grip = kit.pivot(group, spec.gripX, spec.gripY, 0)
  grip.rotation.z = spec.gripLean
  parts.grip = grip
  box(grip, 0.04, 0.108, 0.034, M[spec.gripMaterial], 0, 0, 0)
  box(grip, 0.044, 0.012, 0.036, M.rubber, 0, -0.05, 0)
  parts.trigger = box(group, 0.005, 0.02, 0.005, M.dark, spec.triggerX, spec.gripY + 0.04, 0, 0.2)
  const magazine = kit.pivot(group, spec.magX, spec.magTop, 0)
  magazine.rotation.z = spec.magTilt
  parts.mag = magazine
  const [width, height, depth] = spec.magSize
  box(magazine, width, height, depth, M[spec.magMaterial], 0, -height / 2, 0)
  box(magazine, width * 1.04, 0.01, depth * 1.06, M.dark, 0, -height, 0)
  for (let i = 0; i < 3; i++) box(magazine, width * 0.7, 0.003, depth * 1.02, M.hole, 0, -height * (0.3 + i * 0.2), 0)
  parts.magDrop = height + 0.04
  const bolt = kit.pivot(group)
  parts.bolt = bolt
  box(group, 0.07, 0.02, 0.004, M.hole, spec.ejectX, 0.004, 0.0235)
  box(bolt, 0.05, 0.014, 0.006, M.steelL, spec.ejectX, 0.004, 0.0235)
  parts.eject = kit.mark(group, spec.ejectX, 0.004, 0.03)
}

function addBarrel(look: BullpupLook, from: number, hiderLength: number, hiderRadius: number, spigot: boolean): void {
  const { kit, group, parts, length } = look
  const { M, box, cylinderX } = kit
  const hiderStart = length - hiderLength
  heatify(parts.glow, cylinderX(group, 0.0072, hiderStart - from + 0.01, M.metal, (from + hiderStart) / 2 + 0.005, 0, 0, 14))
  if (spigot) for (let i = 0; i < 6; i++) cylinderX(group, 0.0098, 0.0035, M.metal, from + 0.012 + i * 0.012, 0, 0, 12)
  heatify(parts.glow, cylinderX(group, hiderRadius, hiderLength, M.dark, length - hiderLength / 2, 0, 0, 16))
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4
    box(group, hiderLength * 0.55, 0.003, 0.004, M.hole, length - hiderLength * 0.45, Math.cos(angle) * hiderRadius, Math.sin(angle) * hiderRadius, 0, 0, angle)
  }
  cylinderX(group, 0.0055, 0.004, M.hole, length + 0.0005, 0, 0, 12)
  parts.muzzle = kit.mark(group, length + 0.01, 0, 0)
}

/** FAMAS: black polymer body, the long carry handle ("clairon") over the whole top, the barrel with its grooved spigot, the folding bipod legs along the sides. */
export function buildFamasLook(look: BullpupLook): void {
  const { kit, group } = look
  const { M, box, cylinderX } = kit
  box(group, 0.19, 0.135, 0.05, M.poly, 0.095, -0.0275, 0)
  box(group, 0.014, 0.14, 0.05, M.rubber, 0.007, -0.027, 0)
  box(group, 0.455, 0.078, 0.046, M.poly, 0.4075, 0, 0)
  box(group, 0.2, 0.012, 0.048, M.dark, 0.1, 0.044, 0)
  box(group, 0.348, 0.025, 0.032, M.poly, 0.457, 0.0805, 0)
  box(group, 0.035, 0.056, 0.032, M.poly, 0.3005, 0.064, 0)
  box(group, 0.035, 0.056, 0.032, M.poly, 0.6135, 0.064, 0)
  cylinderX(group, 0.004, 0.3, M.steel, 0.46, 0.052, 0, 8)
  box(group, 0.012, 0.014, 0.012, M.steel, 0.4, 0.052, 0.011)
  box(group, 0.016, 0.02, 0.01, M.dark, 0.6, 0.05, 0)
  for (let i = 0; i < 5; i++) box(group, 0.02, 0.018, 0.05, M.poly, 0.5 + i * 0.027, -0.043, 0, 0, 0, 0)
  for (const side of [1, -1]) {
    cylinderX(group, 0.0032, 0.23, M.steel, 0.5, -0.026, side * 0.0265, 8)
    box(group, 0.012, 0.008, 0.006, M.steel, 0.385, -0.026, side * 0.0265)
  }
  box(group, 0.1, 0.012, 0.004, M.dark, 0.34, 0.0, -0.0235)
  addControls(look, { gripX: 0.375, gripY: -0.092, gripLean: -0.3, magX: 0.24, magTop: -0.04, magTilt: 0.1, magSize: [0.055, 0.095, 0.036], magMaterial: 'polyMag', gripMaterial: 'poly', triggerX: 0.43, ejectX: 0.26 })
  box(look.group, 0.07, 0.005, 0.012, M.dark, 0.435, -0.078, 0)
  box(look.group, 0.005, 0.04, 0.012, M.dark, 0.47, -0.058, 0)
  addBarrel(look, 0.635, 0.03, 0.0105, true)
}

/** IWI Tavor: one chunky olive body, the guard a full hand wide and joined to the front of the body, the barrel barely past it, the reflex sight on a short rail. */
export function buildTavorLook(look: BullpupLook): void {
  const { kit, group } = look
  const { M, box, cylinderX } = kit
  box(group, 0.2, 0.123, 0.054, M.olive, 0.1, -0.0085, 0)
  box(group, 0.19, 0.03, 0.052, M.olive, 0.1, -0.078, 0, 0.16)
  box(group, 0.018, 0.14, 0.054, M.rubber, 0.009, -0.02, 0)
  box(group, 0.22, 0.098, 0.052, M.olive, 0.31, 0.004, 0)
  box(group, 0.18, 0.075, 0.05, M.olive, 0.51, -0.0075, 0)
  box(group, 0.15, 0.024, 0.052, M.olive, 0.52, -0.03, 0)
  rail(kit, group, 0.21, 0.34, 0.056, 0, 0.026)
  rail(kit, group, 0.42, 0.18, 0.0335, 0, 0.026)
  for (let i = 0; i < 4; i++) box(group, 0.012, 0.024, 0.003, M.hole, 0.325 + i * 0.027, 0, 0.0265, 0.6)
  box(group, 0.09, 0.022, 0.003, M.dark, 0.18, -0.03, -0.0265)
  box(group, 0.02, 0.012, 0.004, M.metal, 0.43, -0.05, 0.0255)
  box(group, 0.05, 0.05, 0.04, M.dark, 0.375, 0.082, 0)
  box(group, 0.006, 0.042, 0.034, M.lens, 0.422, 0.084, 0)
  box(group, 0.03, 0.02, 0.03, M.dark, 0.34, 0.07, 0)
  box(group, 0.012, 0.03, 0.012, M.dark, 0.59, 0.05, 0)
  box(group, 0.018, 0.022, 0.012, M.dark, 0.26, 0.068, 0)
  addControls(look, { gripX: 0.322, gripY: -0.098, gripLean: 0.44, magX: 0.215, magTop: -0.045, magTilt: 0.05, magSize: [0.062, 0.12, 0.036], magMaterial: 'worn', gripMaterial: 'olive', triggerX: 0.39, ejectX: 0.17 })
  box(group, 0.11, 0.014, 0.03, M.olive, 0.4125, -0.0925, 0, 1.047)
  box(group, 0.06, 0.016, 0.03, M.olive, 0.365, -0.143, 0)
  cylinderX(group, 0.0073, 0.02, M.metal, look.length - 0.07, 0, 0, 12)
  addBarrel(look, 0.6, 0.06, 0.0115, false)
}

/** L85A2: steel body with the top rail and the SUSAT optic, the tan quad-rail handguard with its round holes, the magazine behind the pistol grip. */
export function buildSa80Look(look: BullpupLook): void {
  const { kit, group } = look
  const { M, box, cylinderX, cylinderZ } = kit
  box(group, 0.03, 0.108, 0.05, M.olive, 0.015, -0.03, 0)
  box(group, 0.39, 0.08, 0.046, M.metal, 0.215, -0.01, 0)
  rail(kit, group, 0.2, 0.21, 0.036, 0, 0.03)
  box(group, 0.014, 0.03, 0.01, M.steelL, 0.235, 0.05, 0.02)
  box(group, 0.075, 0.025, 0.004, M.steel, 0.13, 0.0, 0.0235)
  box(group, 0.238, 0.077, 0.052, M.tan, 0.529, -0.0075, 0)
  rail(kit, group, 0.41, 0.238, 0.036, 0, 0.03)
  rail(kit, group, 0.43, 0.2, -0.0465, 0, 0.03, Math.PI)
  for (const side of [1, -1]) for (let i = 0; i < 5; i++) cylinderZ(group, 0.0065, 0.004, M.hole, 0.44 + i * 0.04, 0.012, side * 0.0262, 12)
  box(group, 0.03, 0.02, 0.02, M.dark, 0.6, 0.044, 0)
  box(group, 0.1, 0.03, 0.034, M.dark, 0.32, 0.05, 0)
  cylinderX(group, 0.022, 0.15, M.dark, 0.32, 0.088, 0, 20)
  cylinderX(group, 0.028, 0.05, M.dark, 0.405, 0.088, 0, 20)
  cylinderX(group, 0.024, 0.002, M.lens, 0.431, 0.088, 0, 20)
  cylinderX(group, 0.017, 0.03, M.rubber, 0.225, 0.088, 0, 16)
  box(group, 0.04, 0.03, 0.03, M.dark, 0.3, 0.12, 0)
  addControls(look, { gripX: 0.336, gripY: -0.098, gripLean: -0.3, magX: 0.215, magTop: -0.05, magTilt: 0.14, magSize: [0.068, 0.15, 0.04], magMaterial: 'polyMag', gripMaterial: 'olive', triggerX: 0.4, ejectX: 0.13 })
  box(group, 0.075, 0.005, 0.01, M.dark, 0.395, -0.066, 0)
  box(group, 0.005, 0.04, 0.01, M.dark, 0.43, -0.046, 0)
  addBarrel(look, 0.648, 0.06, 0.011, false)
}

export type { BullpupLook }
