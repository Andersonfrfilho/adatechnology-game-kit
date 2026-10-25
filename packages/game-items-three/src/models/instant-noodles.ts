import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `instant_noodles`.
 */
export const instantNoodles: ItemModelBuilder = ({ mesh, bx, G, plastic, paper }) => {
  const pouch = mesh(bx(1.2, 1.6, 0.3), plastic(0xcc2020))
  const graphic = mesh(bx(0.8, 0.8, 0.298), paper(0xf5d030))
  return G(pouch, graphic)
}
