import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `handsaw`.
 */
export const handsaw: ItemModelBuilder = ({ mesh, bx, G, metal, wood }) => {
  const blade = mesh(bx(5.0, 0.35, 1.3), metal(0xcccccc))
  const handle = mesh(bx(1.2, 0.352, 0.9), wood(0x8a5533), [-1.9, 0, 0])
  return G(blade, handle)
}
