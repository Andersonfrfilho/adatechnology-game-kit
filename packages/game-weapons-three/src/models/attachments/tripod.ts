import type { ModelKit, Parent } from '../kit'
import type { AttachmentModelBuilder } from './types'

// how far the three legs reach and how thick they are
const LEG = { length: 0.62, width: 0.012 }

/** The tripod of three steel legs under the gun, the head at the origin of `parent`: the creation the counters' mounted M134 and the `tripod` accessory both draw. */
export function buildTripodLegs(kit: ModelKit, parent: Parent): void {
  const { length, width } = LEG
  kit.box(parent, 0.03, 0.06, 0.03, kit.M.metal, 0, 0, 0)
  kit.box(parent, width, length, width, kit.M.metal, -0.2, -0.25, 0, 0.75)
  kit.box(parent, width, length, width, kit.M.metal, 0.22, -0.25, 0.16, -0.75, 0, 0.3)
  kit.box(parent, width, length, width, kit.M.metal, 0.22, -0.25, -0.16, -0.75, 0, -0.3)
}

export const buildTripod: AttachmentModelBuilder = ({ kit }) => {
  const group = kit.group()
  buildTripodLegs(kit, group)
  return group
}
