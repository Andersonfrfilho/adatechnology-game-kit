import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `coffee`.
 */
export const coffee: ItemModelBuilder = ({ mesh, bx, G, metal, paper }) => {
  const pack = mesh(bx(0.8, 1.4, 0.6), metal(0xb52222), [0, -0.05, 0])
  const seal = mesh(bx(0.8, 0.1, 0.1), metal(0x881818), [0, 0.7, 0])
  const label = mesh(bx(0.5, 0.6, 0.01), paper(0xf5e8c0), [0, 0, 0.305])
  return G(pack, seal, label)
}
