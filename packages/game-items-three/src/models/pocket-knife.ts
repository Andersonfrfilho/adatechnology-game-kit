import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pocket_knife`.
 */
export const pocketKnife: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const handle = mesh(bx(1.1, 0.22, 0.32), plastic(0xcc2222))
  const blade = mesh(bx(0.3, 0.15, 0.04), metal(0xd0d0d0), [0.4, 0, 0])
  return G(handle, blade)
}
