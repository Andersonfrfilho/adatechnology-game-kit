import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `maintenance_medication`.
 */
export const maintenanceMedication: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = mesh(cyl(0.225, 0.225, 0.9, 16), plastic(0xffffff))
  const cap = mesh(cyl(0.227, 0.227, 0.15, 16), plastic(0x1a5590), [0, 0.375, 0])
  const label = mesh(cyl(0.229, 0.229, 0.5, 16), paper(0xeeeeee))
  return G(bottle, cap, label)
}
