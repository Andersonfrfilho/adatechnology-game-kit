import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `saline_iv_bag`.
 */
export const salineIvBag: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper }) => {
  const bag = mesh(bx(1.2, 2.3, 0.45), plastic(0xcae5f2), [0, 0.1, 0])
  const port = mesh(cyl(0.08, 0.08, 0.2, 12), plastic(0x1177cc), [0, -1.15, 0])
  const label = mesh(bx(0.8, 1.2, 0.448), paper(0xffffff), [0, 0.1, 0])
  return G(bag, port, label)
}
