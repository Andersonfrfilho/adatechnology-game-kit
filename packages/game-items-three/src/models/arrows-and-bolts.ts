import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `arrows_and_bolts`.
 */
export const arrowsAndBolts: ItemModelBuilder = ({ mesh, bx, G, wood, metal, plastic }) => {
  const shafts = mesh(bx(7.0, 0.25, 0.4), wood(0xa88555))
  const heads = mesh(bx(0.6, 0.252, 0.38), metal(0x777777), [3.2, 0, 0])
  const fletch = mesh(bx(0.8, 0.24, 0.402), plastic(0xcc2222), [-3.0, 0, 0])
  return G(shafts, heads, fletch)
}
