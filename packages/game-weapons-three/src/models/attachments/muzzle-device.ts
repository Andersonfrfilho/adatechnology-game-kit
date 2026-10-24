import { buildBrake } from './muzzle-brake'
import type { AttachmentModelBuilder } from './types'

/** The muzzle brakes by the gallery's drawing (`brake` 1 and 2) and the compensator, a short tube with slots cut in the top. */
export const buildMuzzleBrake = (kind: 1 | 2): AttachmentModelBuilder => ({ kit, frame }) => {
  const group = kit.group()
  buildBrake(kit, group, kind, 0, 0, frame.barrelRadius)
  return group
}

export const buildCompensator: AttachmentModelBuilder = ({ kit, frame }) => {
  const { M, box, cylinderX } = kit
  const radius = frame.barrelRadius * 1.9
  const length = 0.07
  const group = kit.group()
  cylinderX(group, radius, length, M.dark, -length / 2, 0, 0, 16)
  for (let i = 0; i < 3; i++) box(group, length * 0.14, radius * 0.9, radius * 0.7, M.hole, -length * 0.2 - i * length * 0.25, radius * 0.75, 0)
  return group
}
