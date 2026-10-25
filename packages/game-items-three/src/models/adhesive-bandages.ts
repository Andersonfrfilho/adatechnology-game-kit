import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `adhesive_bandages`.
 */
export const adhesiveBandages: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(1.0, 0.6, 0.15), paper(0x2a6cb0))
  const cross = mesh(bx(0.3, 0.3, 0.148), paper(0xcc2222))
  return G(box, cross)
}
