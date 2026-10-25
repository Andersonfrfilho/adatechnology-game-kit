import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `multivitamin`.
 */
export const multivitamin: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = mesh(cyl(0.25, 0.25, 0.9, 16), plastic(0xe08020))
  const cap = mesh(cyl(0.252, 0.252, 0.15, 16), plastic(0xffffff), [0, 0.375, 0])
  const label = mesh(cyl(0.254, 0.254, 0.5, 16), paper(0xffffff))
  return G(bottle, cap, label)
}
