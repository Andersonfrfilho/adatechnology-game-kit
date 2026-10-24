import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `n95_mask`.
 */
export const n95Mask: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const mask = mesh(bx(1.5, 1.1, 0.25), cloth(0xe8e8e8))
  const clip = mesh(bx(0.6, 0.05, 0.248), metal(0xaaaaaa), [0, 0.45, 0])
  return G(mask, clip)
}
