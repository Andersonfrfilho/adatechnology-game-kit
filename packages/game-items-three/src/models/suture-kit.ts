import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `suture_kit`.
 */
export const sutureKit: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const pouch = mesh(bx(1.5, 0.8, 0.3), plastic(0x106090))
  const tool = mesh(bx(1.2, 0.05, 0.298), metal(0xcccccc))
  return G(pouch, tool)
}
