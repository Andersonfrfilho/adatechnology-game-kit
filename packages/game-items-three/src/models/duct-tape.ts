import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `duct_tape`.
 */
export const ductTape: ItemModelBuilder = ({ mesh, cyl, G, cloth, paper }) => {
  const roll = mesh(cyl(0.5, 0.5, 0.5, 16), cloth(0x888888))
  const core = mesh(cyl(0.25, 0.25, 0.502, 14), paper(0x8a7050))
  return G(roll, core)
}
