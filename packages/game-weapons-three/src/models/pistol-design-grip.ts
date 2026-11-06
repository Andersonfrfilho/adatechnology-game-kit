import type * as THREE from 'three'
import type { ModelKit } from './kit'
import type { DesignMaterial, PistolDesign } from './pistol-design-config'
import type { ModelParts } from './types'

/** Where the front strap of the grip meets the trigger guard: x at the height `y`. */
export type FrontStrap = { readonly x: number; readonly y: number }

/** The grip with its straps, texture, flared magwell and the magazine, plus the backstrap filler that reaches up to the slide's rear. Returns the front strap line. */
export function buildDesignGrip(kit: ModelKit, group: THREE.Group, parts: ModelParts, design: PistolDesign, frameMaterial: DesignMaterial, anchor: FrontStrap): (y: number) => number {
  const { M, box } = kit
  const { gripDepth: depth, gripWidth: width, gripLength: length, gripAngle: angle, slideHeight: sh } = design
  const topY = -sh / 2 + 0.004
  const frontAt = (y: number): number => anchor.x - (y - anchor.y) * Math.tan(angle)
  const centerY = topY - (length / 2) * Math.cos(angle)
  const centerX = frontAt(centerY) - depth / (2 * Math.cos(angle))
  const grip = kit.pivot(group, centerX, centerY, 0)
  grip.rotation.z = angle
  parts.grip = grip
  const stipple = design.frameFinish === 'tan' ? M.worn : M.dark
  kit.roundness = 0.3
  box(grip, depth, length, width, frameMaterial, 0, 0, 0)
  const wedgeAngle = angle * 0.9
  const wedgeLength = length * 0.8
  const wedgeDepth = frontAt(topY) - depth / Math.cos(angle) + 0.004
  const wedgeX = wedgeDepth / 2 - 0.002 + (wedgeLength / 2) * Math.sin(wedgeAngle)
  box(group, wedgeDepth, wedgeLength, width * 0.96, frameMaterial, wedgeX, topY - (wedgeLength / 2) * Math.cos(wedgeAngle), 0, wedgeAngle)
  kit.roundness = null
  for (const side of [-1, 1]) {
    box(grip, depth * 0.55, length * 0.5, 0.0016, stipple, -depth * 0.02, -length * 0.1, side * (width / 2 + 0.0004))
    if (design.hasDimples) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(grip, 0.0028, 0.0028, 0.0012, M.dark, -depth * 0.28 + j * 0.0075, length * 0.2 - i * 0.0105, side * (width / 2 + 0.0008))
  }
  if (design.hasFrontStrapRidges) for (let i = 0; i < 7; i++) box(grip, 0.0034, 0.0034, width * 0.9, M.dark, depth / 2 + 0.0008, length * 0.28 - i * 0.0105, 0)
  if (design.hasBackstrap) for (let i = 0; i < 5; i++) box(grip, 0.003, 0.003, width * 0.8, M.dark, -depth / 2 - 0.0008, length * 0.3 - i * 0.012, 0)
  box(grip, depth + 0.006, 0.012, width + 0.004, frameMaterial, 0.002, -length / 2 + 0.006, 0)
  const magazine = kit.pivot(grip)
  parts.mag = magazine
  parts.magDrop = length * 1.15
  box(magazine, 0.024, length * 0.94, width * 0.7, M.dark, 0.003, -0.004, 0)
  box(magazine, depth + 0.004, 0.007, width + 0.003, M.dark, 0.002, -length / 2 - 0.0035, 0)
  return frontAt
}
