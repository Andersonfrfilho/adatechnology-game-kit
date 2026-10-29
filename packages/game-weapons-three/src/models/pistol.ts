import type * as THREE from 'three'
import type { ModelKit } from './kit'
import { buildSlide } from './pistol-slide'
import type { Material, PistolSize, PistolStyle } from './pistol-style'
import { STYLES } from './pistol-style'
import type { BuiltModel, ModelOptions, ModelParts } from './types'

const PI = Math.PI

/** Frame, grip and magazine below the slide. Returns the grip x and the trigger guard line the guard is drawn from. */
function buildFrame(kit: ModelKit, group: THREE.Group, parts: ModelParts, options: ModelOptions, style: PistolStyle, size: PistolSize, materials: { frame: Material; grip: Material }): { gx: number; ty: number } {
  const { M, box, cylinderZ, sphere } = kit
  const { length: L, height: h, width: w } = size
  const fm = materials.frame
  if (style.inset) {
    box(group, L * 0.9, h * 0.35, w * 0.12, fm, L * 0.47, -h * 0.32, w * 0.47)
    box(group, L * 0.9, h * 0.35, w * 0.12, fm, L * 0.47, -h * 0.32, -w * 0.47)
  }
  const frameLength = style.tri ? L * 0.66 : L * 0.8
  kit.roundness = style.rf
  box(group, frameLength, 0.016, w * 0.92, fm, frameLength / 2 + L * 0.06, -h / 2 - 0.008, 0)
  kit.roundness = null
  if (style.rail) for (let i = 0; i < (style.slope ? 5 : 3); i++) box(group, 0.004, 0.003, w * 0.96, M.dark, L * 0.62 + i * 0.009, -h / 2 - 0.017, 0)
  const isGlock = options.st === 'glock' || !options.st
  if (isGlock) {
    box(group, 0.008, 0.004, 0.003, M.dark, L * 0.5, -h / 2 - 0.003, -w / 2 - 0.0012)
    box(group, 0.008, 0.004, 0.003, M.dark, L * 0.5, -h / 2 - 0.003, w / 2 + 0.0012)
  }
  if (style.slideStop) {
    box(group, 0.03, 0.006, 0.003, M.dark, L * 0.42, -h / 2 - 0.002, -w / 2 - 0.0014)
    sphere(group, 0.0028, M.dark, L * 0.55, -h / 2 - 0.003, w / 2 + 0.001, 1)
  } else box(group, 0.012, 0.004, 0.003, M.dark, L * 0.45, -h / 2 - 0.003, -w / 2 - 0.0012)
  if (style.decock === 'frame') box(group, 0.01, 0.012, 0.003, M.dark, L * 0.38, -h / 2 - 0.012, -w / 2 - 0.0014, 0.6)
  if (style.safety === 'thumb') parts.safety = box(group, 0.014, 0.006, 0.004, M.dark, 0.02, -h / 2 - 0.002, -w / 2 - 0.0016)
  const gripLength = options.gl ?? 0.105
  const gx = 0.034 + (L - 0.2) * 0.15
  const gy = -h / 2 - gripLength / 2 + 0.006
  const grip = kit.pivot(group, gx, gy, 0)
  grip.rotation.z = style.ga
  parts.grip = grip
  const gripWidth = style.grip === 'chunky' ? w * 1.18 : w * 1.06
  const gripDepth = style.grip === 'chunky' ? 0.036 : 0.032
  kit.roundness = 0.3
  if (style.grip === 'wood' || style.grip === 'star') {
    box(grip, gripDepth * 0.86, gripLength, w * 0.9, fm, 0, 0, 0)
    box(grip, gripDepth * 0.8, gripLength * 0.86, 0.004, materials.grip, 0.001, -0.002, w * 0.47)
    box(grip, gripDepth * 0.8, gripLength * 0.86, 0.004, materials.grip, 0.001, -0.002, -w * 0.47)
    if (style.grip === 'wood') {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) box(grip, 0.003, 0.003, 0.0012, M.woodL, -0.006 + j * 0.012, -gripLength * 0.3 + i * 0.012, w * 0.495, 0, 0, 0)
      cylinderZ(grip, 0.0035, 0.0015, M.brass, 0, gripLength * 0.25, w * 0.5, 10)
      cylinderZ(grip, 0.0035, 0.0015, M.brass, 0, -gripLength * 0.3, w * 0.5, 10)
    } else cylinderZ(grip, 0.008, 0.0015, M.dark, 0, gripLength * 0.1, w * 0.5, 5)
  } else box(grip, gripDepth, gripLength, gripWidth, materials.grip, 0, 0, 0)
  kit.roundness = null
  if (style.grip === 'finger') {
    for (let i = 0; i < 3; i++) box(grip, 0.006, 0.012, gripWidth * 0.98, materials.grip, gripDepth / 2 + 0.002, gripLength * 0.18 - i * 0.022, 0)
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) box(grip, 0.003, 0.003, 0.0012, M.dark, -0.008 + j * 0.008, -gripLength * 0.25 + i * 0.012, gripWidth / 2 + 0.0004)
  }
  if (style.grip === 'panel' || style.grip === 'rubber' || style.grip === 'chunky') for (let i = 0; i < 6; i++) box(grip, gripDepth * 0.75, 0.0025, gripWidth + 0.001, M.dark, 0.002, -gripLength / 2 + 0.018 + i * 0.013, 0)
  if (style.grip === 'chunky') box(grip, 0.008, gripLength * 0.8, gripWidth * 0.9, materials.grip, gripDepth / 2 + 0.002, -0.004, 0)
  if (style.beaver) {
    box(group, 0.026, 0.008, w * 0.9, fm, -0.004, -h / 2 - 0.004, 0, 0.25)
    box(grip, 0.006, gripLength * 0.55, w * 0.9, fm, -gripDepth * 0.5 - 0.002, gripLength * 0.18, 0)
  } else box(group, 0.02, 0.009, w * 0.9, fm, 0.004, -h / 2 - 0.006, 0)
  if (style.lanyard) {
    const ring = kit.torus(grip, new kit.THREE.TorusGeometry(0.005, 0.0013, 6, 12), M.dark, -0.012, -gripLength / 2 + 0.004, 0)
    ring.position.set(-0.012, -gripLength / 2 + 0.004, 0)
  }
  const magazine = kit.pivot(grip)
  parts.mag = magazine
  parts.magDrop = gripLength * 1.15
  box(magazine, 0.022, gripLength * 0.94, w * 0.72, M.dark, 0.003, -0.004, 0)
  if (style.grip === 'chunky') box(magazine, 0.04, 0.01, gripWidth * 1.02, M.poly, 0.003, -gripLength / 2 - 0.004, 0)
  else if (style.flush || style.grip === 'wood') box(magazine, 0.028, 0.004, w * 0.9, M.steel, 0.003, -gripLength / 2 - 0.001, 0)
  else box(magazine, 0.031, 0.006, gripWidth * 1.02, M.dark, 0.003, -gripLength / 2 - 0.002, 0)
  return { gx, ty: -h / 2 }
}

/** Port of the gallery's `pistol` (Galeria 3D do Arsenal): slide, frame, grip, magazine, trigger and hammer, in the order the page adds them. */
export function buildPistol(kit: ModelKit, options: ModelOptions): BuiltModel {
  const { M, box } = kit
  const style = { ...STYLES[options.st ?? 'glock'] } as PistolStyle
  const group = kit.group()
  const parts: ModelParts = { family: 'pistol', kick: options.deagle ? 1.8 : 0.6, glow: [] }
  const size: PistolSize = { length: ((options.L ?? 0) / 1000) * 0.97, height: (options.h ?? 0.031) * (style.tall ?? 1), width: options.deagle ? 0.032 : style.flush ? 0.024 : 0.025 }
  const { length: L, height: h, width: w } = size
  const slideMetal = options.steel ? M.steel : options.stain ? M.steelL : M.metal
  const frameMetal = style.frame === 'poly' ? M.poly : slideMetal
  const gripMaterial = style.grip === 'wood' ? M.wood : style.grip === 'star' ? M.bake : style.grip === 'rubber' ? M.rubber : M.poly
  const slide = kit.pivot(group)
  parts.slide = slide
  parts.stroke = L * 0.15
  buildSlide(kit, slide, parts, options, style, size, slideMetal)
  const { gx, ty } = buildFrame(kit, group, parts, options, style, size, { frame: frameMetal, grip: gripMaterial })
  if (style.guard === 'square') {
    box(group, 0.046, 0.004, 0.009, frameMetal, gx + 0.05, ty - 0.034, 0)
    box(group, 0.004, 0.03, 0.009, frameMetal, gx + 0.074, ty - 0.02, 0)
    box(group, 0.006, 0.004, 0.009, frameMetal, gx + 0.075, ty - 0.034, 0)
  } else if (style.guard === 'hook') {
    box(group, 0.046, 0.004, 0.009, frameMetal, gx + 0.05, ty - 0.034, 0)
    box(group, 0.004, 0.03, 0.009, frameMetal, gx + 0.073, ty - 0.02, 0, 0.2)
    box(group, 0.008, 0.006, 0.009, frameMetal, gx + 0.074, ty - 0.037, 0, 0.4)
  } else {
    const guard = kit.torus(group, new kit.THREE.TorusGeometry(0.019, 0.0022, 6, 16, PI), frameMetal, gx + 0.05, ty - 0.014, 0)
    guard.rotation.z = PI
    guard.scale.set(1.2, 1, 1)
  }
  const isGlock = options.st === 'glock' || !options.st
  parts.trigger = box(group, 0.004, 0.014, 0.004, isGlock ? M.dark : M.steel, gx + 0.042, ty - 0.022, 0, 0.2)
  if (isGlock) box(parts.trigger, 0.0015, 0.008, 0.0045, M.metal, 0, -0.001, 0)
  if (style.hammer) {
    const hammer = kit.pivot(group, 0.003, h / 2 - 0.008, 0)
    parts.hammer = hammer
    if (style.hammer === 'ring') {
      box(hammer, 0.006, 0.012, 0.006, M.dark, -0.002, 0.004, 0, 0.3)
      kit.torus(hammer, new kit.THREE.TorusGeometry(0.0045, 0.0016, 6, 12), M.dark, -0.004, 0.012, 0)
    } else if (style.hammer === 'big') box(hammer, 0.014, 0.02, 0.009, M.dark, -0.004, 0.007, 0, 0.35)
    else {
      box(hammer, 0.008, 0.016, 0.007, M.dark, -0.002, 0.006, 0, 0.3)
      box(hammer, 0.008, 0.004, 0.008, M.dark, -0.006, 0.013, 0, 0.3)
    }
  }
  parts.muzzle = kit.mark(group, L + 0.006, style.tri ? h * 0.08 : 0.002, 0)
  parts.eject = kit.mark(group, L * 0.6, h / 2, w * 0.25)
  return { group, parts }
}
