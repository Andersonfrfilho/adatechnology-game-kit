import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `barbed_wire`.
 */
export const barbedWire: ItemModelBuilder = ({ mesh, cyl, bx, G, metal }) => {
  const coil = mesh(cyl(1.5, 1.5, 1.2, 16), metal(0x777777))
  const tie = mesh(bx(0.15, 0.1, 3.0), metal(0x999999), [0, 0.55, 0])
  return G(coil, tie)
}
