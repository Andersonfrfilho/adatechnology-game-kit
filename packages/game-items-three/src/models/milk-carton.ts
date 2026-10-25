import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `milk_carton`.
 */
export const milkCarton: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.7, 2.0, 0.7), paper(0xeeeedd))
  const label = mesh(bx(0.702, 1.0, 0.702), paper(0x3366cc))
  const cap = mesh(cyl(0.1, 0.1, 0.06, 12), plastic(0x1177cc), [0, 0.75, 0.2])
  return G(carton, label, cap)
}
