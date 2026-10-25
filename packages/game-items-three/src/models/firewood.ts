import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `firewood`.
 */
export const firewood: ItemModelBuilder = ({ mesh, bx, G, wood }) => {
  const stack = mesh(bx(4.0, 1.2, 1.6), wood(0x5a3e26))
  const cutFace = mesh(bx(0.01, 1.18, 1.58), wood(0xbda07a), [2.001, 0, 0])
  return G(stack, cutFace)
}
