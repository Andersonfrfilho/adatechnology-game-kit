import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `police_baton`.
 */
export const policeBaton: ItemModelBuilder = ({ mesh, bx, G, plastic }) => {
  const shaft = mesh(bx(5.0, 0.45, 0.45), plastic(0x1a1a1a))
  const sideHandle = mesh(bx(0.45, 1.0, 0.45), plastic(0x1a1a1a), [-1.3, 0.275, 0])
  return G(shaft, sideHandle)
}
