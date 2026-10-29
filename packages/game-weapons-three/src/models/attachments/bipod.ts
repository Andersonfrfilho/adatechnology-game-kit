import type { AttachmentModelBuilder } from './types'
import type { Parent, ModelKit } from '../kit'

/** The bipod of the gallery's rifles: the hinge block and the two splayed legs with rubber feet, hinged at (`x`, `y`) of `parent`. */
export function buildBipod(kit: ModelKit, parent: Parent, x: number, y: number): void {
  const { M, box, cylinderX } = kit
  cylinderX(parent, 0.008, 0.02, M.dark, x, y, 0, 12)
  for (const side of [-1, 1]) {
    const leg = kit.pivot(parent, x, y, side * 0.012)
    leg.rotation.set(side * 0.15, 0, -0.35)
    box(leg, 0.006, 0.2, 0.006, M.dark, 0, -0.1, 0)
    box(leg, 0.01, 0.006, 0.01, M.rubber, 0, -0.2, 0)
  }
}

export const buildBipodModel: AttachmentModelBuilder = ({ kit }) => {
  const group = kit.group()
  buildBipod(kit, group, 0, 0)
  return group
}
