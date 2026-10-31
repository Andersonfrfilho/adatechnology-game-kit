import { asLid } from '../opening'

import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `communion_wine`.
 */
export const communionWine: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, glass, paper, metal }) => {
  const bottle = mesh(lathe([[0, -1.5], [0.33, -1.5], [0.38, -1.42], [0.38, 0.4], [0.37, 0.55], [0.2, 0.9], [0.135, 1.05], [0.135, 1.12], [0, 1.12]], 12), glass(0x3a1015, 0.85))
  const label = mesh(cyl(0.382, 0.382, 0.9, 12), paper(0xe3d8b0), [0, -0.4, 0])
  const goldBand = mesh(cyl(0.382, 0.382, 0.05, 12), metal(0xb58830), [0, 0.075, 0])
  const crossUpright = mesh(bx(0.06, 0.26, 0.02), paper(0x7a1f2b), [0, -0.35, 0.375])
  const crossArm = mesh(bx(0.18, 0.06, 0.02), paper(0x7a1f2b), [0, -0.3, 0.375])
  const foil = asLid(mesh(cyl(0.15, 0.15, 0.46, 12), metal(0xb58830), [0, 1.27, 0]))
  return G(bottle, label, goldBand, crossUpright, crossArm, foil)
}
