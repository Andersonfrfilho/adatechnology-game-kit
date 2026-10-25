import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pliers`.
 */
export const pliers: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const head = mesh(bx(2.0, 0.3, 0.7), metal(0x777777))
  const grip = mesh(bx(1.2, 0.302, 0.6), plastic(0xdd6611), [-0.35, 0, 0])
  return G(head, grip)
}
