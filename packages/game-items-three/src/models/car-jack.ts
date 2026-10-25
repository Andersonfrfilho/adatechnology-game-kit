import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `car_jack`.
 */
export const carJack: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const base = mesh(bx(3.0, 0.9, 1.1), metal(0xbb2222), [0, -0.1, 0])
  const piston = mesh(cyl(0.3, 0.3, 0.2, 14), metal(0xcccccc), [0, 0.45, 0])
  return G(base, piston)
}
