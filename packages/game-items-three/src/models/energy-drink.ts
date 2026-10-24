import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `energy_drink`.
 */
export const energyDrink: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, paper }) => {
  const can = mesh(cyl(0.29, 0.29, 1.35, 16), metal(0x111111))
  const label = mesh(cyl(0.292, 0.292, 0.8, 16), paper(0x00d050))
  const tab = mesh(bx(0.08, 0.01, 0.14), metal(0x999999), [0, 0.67, 0.06])
  return G(can, label, tab)
}
