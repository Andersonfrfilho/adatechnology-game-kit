import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `communion_wine`.
 */
export const communionWine: ItemModelBuilder = ({ mesh, cyl, G, glass, paper, metal }) => {
  const bottle = mesh(cyl(0.38, 0.38, 3.0, 16), glass(0x3a1015, 0.8))
  const label = mesh(cyl(0.382, 0.382, 1.0, 16), paper(0xd8cca0))
  const foil = mesh(cyl(0.18, 0.18, 0.4, 14), metal(0xb58830), [0, 1.3, 0])
  return G(bottle, label, foil)
}
