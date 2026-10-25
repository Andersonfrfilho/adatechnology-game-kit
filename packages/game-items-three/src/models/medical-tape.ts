import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `medical_tape`.
 */
export const medicalTape: ItemModelBuilder = ({ mesh, cyl, G, cloth, plastic }) => {
  const roll = mesh(cyl(0.25, 0.25, 0.25, 16), cloth(0xdedad2))
  const spool = mesh(cyl(0.12, 0.12, 0.252, 14), plastic(0xffffff))
  return G(roll, spool)
}
