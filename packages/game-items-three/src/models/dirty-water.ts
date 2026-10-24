import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `dirty_water`.
 */
export const dirtyWater: ItemModelBuilder = ({ mesh, cyl, G, plastic }) => {
  const bottle = mesh(cyl(0.33, 0.33, 1.83, 16), plastic(0x756b50))
  const cap = mesh(cyl(0.18, 0.18, 0.14, 14), plastic(0x444444), [0, 0.84, 0])
  return G(bottle, cap)
}
