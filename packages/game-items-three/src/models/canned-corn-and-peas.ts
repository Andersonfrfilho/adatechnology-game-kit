import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `canned_corn_and_peas`.
 */
export const cannedCornAndPeas: ItemModelBuilder = ({ mesh, cyl, G, metal, paper }) => {
  const can = mesh(cyl(0.365, 0.365, 0.85, 16), metal(0xd0d0d0))
  const label = mesh(cyl(0.367, 0.367, 0.6, 16), paper(0x2d7a3a))
  return G(can, label)
}
