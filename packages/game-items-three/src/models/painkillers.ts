import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `painkillers`.
 */
export const painkillers: ItemModelBuilder = ({ mesh, bx, G, paper, metal }) => {
  const pack = mesh(bx(0.6, 0.2, 0.4), paper(0xcc2222))
  const foil = mesh(bx(0.58, 0.01, 0.38), metal(0xd0d0d0), [0, -0.095, 0])
  return G(pack, foil)
}
