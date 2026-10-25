import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lighter`.
 */
export const lighter: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const body = mesh(bx(0.25, 0.65, 0.12), plastic(0x1177cc), [0, -0.075, 0])
  const hood = mesh(bx(0.24, 0.15, 0.11), metal(0xcccccc), [0, 0.325, 0])
  return G(body, hood)
}
