import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `povidone_iodine`.
 */
export const povidoneIodine: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper }) => {
  const bottle = mesh(bx(0.45, 1.1, 0.35), plastic(0x602010))
  const cap = mesh(cyl(0.1, 0.1, 0.1, 12), plastic(0xeeeeee), [0, 0.5, 0])
  const label = mesh(bx(0.35, 0.5, 0.01), paper(0xffffff), [0, 0, 0.176])
  return G(bottle, cap, label)
}
