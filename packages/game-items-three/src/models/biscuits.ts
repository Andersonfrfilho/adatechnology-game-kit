import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `biscuits`.
 */
export const biscuits: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const pack = mesh(bx(2.0, 0.5, 1.0), paper(0xd4af37))
  const graphic = mesh(bx(1.6, 0.35, 0.01), paper(0x9a3a2a), [0, 0, 0.505])
  return G(pack, graphic)
}
