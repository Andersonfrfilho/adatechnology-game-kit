import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `jerked_beef`.
 */
export const jerkedBeef: ItemModelBuilder = ({ mesh, bx, G, plastic, paper }) => {
  const pack = mesh(bx(2.5, 0.25, 1.5), plastic(0x4a1810))
  const label = mesh(bx(1.5, 0.248, 0.8), paper(0xf0d090))
  return G(pack, label)
}
