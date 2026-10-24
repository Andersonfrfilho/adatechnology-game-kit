import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `knife`.
 */
export const knife: ItemModelBuilder = ({ mesh, bx, G, metal, wood }) => {
  const blade = mesh(bx(2.5, 0.3, 0.4), metal(0xd5d5d5))
  const handle = mesh(bx(0.9, 0.302, 0.35), wood(0x4a2a10), [-0.8, 0, 0])
  return G(blade, handle)
}
