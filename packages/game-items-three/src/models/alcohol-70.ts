import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `alcohol_70`.
 */
export const alcohol70: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper }) => {
  const bottle = mesh(bx(0.7, 2.0, 0.5), plastic(0x99ccdd))
  const cap = mesh(cyl(0.15, 0.15, 0.15, 14), plastic(0x1166bb), [0, 0.95, 0])
  const label = mesh(bx(0.5, 0.8, 0.01), paper(0xffffff), [0, 0, 0.251])
  return G(bottle, cap, label)
}
