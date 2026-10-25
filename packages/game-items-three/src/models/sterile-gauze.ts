import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sterile_gauze`.
 */
export const sterileGauze: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const pack = mesh(bx(1.0, 1.0, 0.15), paper(0x4080b0))
  const label = mesh(bx(0.8, 0.8, 0.148), paper(0xffffff))
  return G(pack, label)
}
