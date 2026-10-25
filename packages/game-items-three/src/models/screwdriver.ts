import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `screwdriver`.
 */
export const screwdriver: ItemModelBuilder = ({ mesh, cyl, G, plastic, metal }) => {
  const shaft = mesh(cyl(0.06, 0.06, 2.2, 12), metal(0xcccccc), [0, 0, 0], [0, 0, Math.PI / 2])
  const handle = mesh(cyl(0.2, 0.2, 0.9, 16), plastic(0xdd8811), [-0.65, 0, 0], [0, 0, Math.PI / 2])
  return G(shaft, handle)
}
