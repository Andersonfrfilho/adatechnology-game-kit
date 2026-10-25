import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `thermometer`.
 */
export const thermometer: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const body = mesh(bx(1.0, 0.2, 0.3), plastic(0xeeeeee), [-0.1, 0, 0])
  const tip = mesh(bx(0.2, 0.16, 0.16), metal(0xcccccc), [0.5, 0, 0])
  return G(body, tip)
}
