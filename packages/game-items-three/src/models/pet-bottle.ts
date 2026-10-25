import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pet_bottle`.
 */
export const petBottle: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = mesh(cyl(0.525, 0.525, 3.3, 16), plastic(0xcae8d8))
  const cap = mesh(cyl(0.2, 0.2, 0.15, 14), plastic(0x1565c0), [0, 1.575, 0])
  const label = mesh(cyl(0.527, 0.527, 0.8, 16), paper(0xcc2222), [0, -0.2, 0])
  return G(bottle, cap, label)
}
