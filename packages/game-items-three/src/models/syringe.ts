import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `syringe`.
 */
export const syringe: ItemModelBuilder = ({ mesh, cyl, G, plastic, metal }) => {
  const barrel = mesh(cyl(0.1, 0.1, 1.2, 16), plastic(0xddeeff), [-0.15, 0, 0], [0, 0, Math.PI / 2])
  const needle = mesh(cyl(0.015, 0.015, 0.3, 8), metal(0xcccccc), [0.6, 0, 0], [0, 0, Math.PI / 2])
  return G(barrel, needle)
}
