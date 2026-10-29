import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `energy_drink`.
 */
export const energyDrink: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, paper }) => {
  const shell = metal(0x1a1a1a)
  const foot = mesh(cyl(0.29, 0.25, 0.12, 12), shell, [0, -0.615, 0])
  const body = mesh(cyl(0.29, 0.29, 1.0, 12), shell, [0, -0.055, 0])
  const label = mesh(cyl(0.292, 0.292, 0.8, 12), paper(0x00c853), [0, -0.055, 0])
  const upperBand = mesh(cyl(0.292, 0.292, 0.05, 12), paper(0xf0f0f0), [0, 0.37, 0])
  const lowerBand = mesh(cyl(0.292, 0.292, 0.05, 12), paper(0xf0f0f0), [0, -0.48, 0])
  const neck = mesh(cyl(0.235, 0.29, 0.12, 12), shell, [0, 0.505, 0])
  const lid = mesh(cyl(0.24, 0.24, 0.12, 12), metal(0x999999), [0, 0.615, 0])
  const tab = mesh(bx(0.08, 0.008, 0.14), metal(0x777777), [0, 0.671, 0.05])
  return G(foot, body, label, upperBand, lowerBand, neck, lid, tab)
}
