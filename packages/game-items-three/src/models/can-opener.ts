import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `can_opener`.
 */
export const canOpener: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const frame = mesh(bx(1.4, 0.35, 0.25), metal(0xaaaaaa), [0, -0.025, 0])
  const handle = mesh(cyl(0.06, 0.06, 0.2, 10), plastic(0xcc2222), [-0.4, 0.1, 0])
  return G(frame, handle)
}
