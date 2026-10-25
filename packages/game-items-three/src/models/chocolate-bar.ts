import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `chocolate_bar`.
 */
export const chocolateBar: ItemModelBuilder = ({ mesh, bx, G, metal, paper }) => {
  const foil = mesh(bx(1.5, 0.7, 0.1), metal(0xd0d0d0))
  const sleeve = mesh(bx(1.1, 0.698, 0.098), paper(0x4a2414))
  const logo = mesh(bx(0.7, 0.4, 0.099), paper(0xd4af37))
  return G(foil, sleeve, logo)
}
