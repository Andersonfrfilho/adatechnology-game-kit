import type * as THREE from 'three'
import type { ModelKit } from './kit'
import type { DesignMaterial, PistolDesign } from './pistol-design-config'
import type { ModelParts } from './types'

/** The grip: one raked box under the rear of the slide with its texture and the magazine inside it (only the baseplate shows). Returns x of the front strap at a height. */
export function buildDesignGrip(kit: ModelKit, group: THREE.Group, parts: ModelParts, design: PistolDesign, frameMaterial: DesignMaterial): (y: number) => number {
  const { M, box } = kit
  const { gripDepth: depth, gripWidth: width, gripLength: length, gripAngle: angle, slideHeight: sh } = design
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const topY = -sh / 2 + 0.004
  const centerX = design.gripRearX + (depth / 2) * cos + (length / 2) * sin
  const centerY = topY - (length / 2) * cos + (depth / 2) * sin
  const grip = kit.pivot(group, centerX, centerY, 0)
  grip.rotation.z = angle
  parts.grip = grip
  const stipple = design.frameFinish === 'tan' ? M.worn : M.dark
  kit.roundness = 0.25
  box(grip, depth, length, width, frameMaterial, 0, 0, 0)
  kit.roundness = null
  for (const side of [-1, 1]) {
    box(grip, depth * 0.6, length * 0.55, 0.0016, stipple, -depth * 0.02, -length * 0.06, side * (width / 2 + 0.0004))
    if (design.hasDimples) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(grip, 0.0028, 0.0028, 0.0012, M.dark, -depth * 0.28 + j * 0.0075, length * 0.2 - i * 0.0105, side * (width / 2 + 0.0008))
  }
  if (design.hasFrontStrapRidges) for (let i = 0; i < 7; i++) box(grip, 0.0034, 0.0034, width * 0.9, M.dark, depth / 2 + 0.0008, length * 0.28 - i * 0.0105, 0)
  if (design.hasBackstrap) for (let i = 0; i < 5; i++) box(grip, 0.003, 0.003, width * 0.8, M.dark, -depth / 2 - 0.0008, length * 0.3 - i * 0.012, 0)
  const magazine = kit.pivot(grip)
  parts.mag = magazine
  parts.magDrop = length * 1.15
  box(magazine, depth * 0.7, length * 0.94, width * 0.7, M.dark, 0.003, -0.004, 0)
  box(magazine, depth + design.magwellFlare, 0.008, width + design.magwellFlare * 0.6, M.dark, design.magwellFlare / 2, -length / 2 - 0.002, 0)
  const frontTopX = centerX + (depth / 2) * cos - (length / 2) * sin
  const frontTopY = centerY + (depth / 2) * sin + (length / 2) * cos
  return (y) => frontTopX + (frontTopY - y) * Math.tan(angle)
}
