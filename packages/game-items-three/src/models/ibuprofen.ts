import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `ibuprofen`.
 */
export const ibuprofen: ItemModelBuilder = ({ mesh, bx, G, paper, metal }) => {
  const pack = mesh(bx(0.95, 0.5, 0.15), paper(0xe06020))
  const foil = mesh(bx(0.9, 0.48, 0.01), metal(0xd0d0d0), [0, 0, -0.07])
  return G(pack, foil)
}
