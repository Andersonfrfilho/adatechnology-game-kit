import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `copper_wire`.
 */
export const copperWire: ItemModelBuilder = ({ mesh, cyl, G, metal, plastic }) => {
  const coil = mesh(cyl(0.4, 0.4, 0.3, 16), metal(0xb86030))
  const core = mesh(cyl(0.2, 0.2, 0.302, 16), plastic(0x222222))
  return G(coil, core)
}
