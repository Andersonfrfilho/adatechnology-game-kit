import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `soda_can`.
 */
export const sodaCan: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, paper }) => {
  const can = mesh(cyl(0.33, 0.33, 1.2, 16), metal(0xb51818))
  const label = mesh(cyl(0.332, 0.332, 0.7, 16), paper(0xffffff))
  const tab = mesh(bx(0.1, 0.01, 0.18), metal(0xb0b8bf), [0, 0.595, 0.08])
  return G(can, label, tab)
}
