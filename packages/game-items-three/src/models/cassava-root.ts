import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cassava_root`.
 */
export const cassavaRoot: ItemModelBuilder = ({ mesh, cyl, G, food }) => {
  const skin = food(0x7a5230)
  return G(
    mesh(cyl(0.35, 0.3, 1.2, 8), skin, [-1.38, 0, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(0.3, 0.2, 1.5, 8), food(0x6b4528), [-0.05, 0.02, 0], [0, 0, Math.PI / 2 + 0.05]),
    mesh(cyl(0.2, 0.05, 1.3, 8), skin, [1.35, 0.02, 0], [0, 0, Math.PI / 2 + 0.1]),
    mesh(cyl(0.34, 0.34, 0.04, 8), food(0xf1ead6), [-1.98, 0, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(0.05, 0.05, 0.05, 6), food(0x4a3018), [-1.99, 0, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(0.355, 0.355, 0.06, 8), food(0x5c3c20), [-0.95, 0, 0], [0, 0, Math.PI / 2]),
  )
}
