import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `wire_roll`.
 */
export const wireRoll: ItemModelBuilder = ({ mesh, cyl, G, metal, plastic }) => {
  const coil = mesh(cyl(0.7, 0.7, 0.5, 16), metal(0x8a8a8a))
  const core = mesh(cyl(0.35, 0.35, 0.502, 16), plastic(0x222222))
  return G(coil, core)
}
