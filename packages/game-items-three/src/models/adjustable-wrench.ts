import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `adjustable_wrench`.
 */
export const adjustableWrench: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const wrench = mesh(bx(2.5, 0.2, 0.6), metal(0x888888))
  const jaw = mesh(bx(0.6, 0.19, 0.3), metal(0x666666), [0.9, 0, 0])
  return G(wrench, jaw)
}
