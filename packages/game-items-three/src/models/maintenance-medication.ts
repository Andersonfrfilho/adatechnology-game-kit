import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `maintenance_medication`.
 */
export const maintenanceMedication: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, plastic, paper }) => {
  const bottle = mesh(lathe([[0, -0.45], [0.19, -0.45], [0.21, -0.42], [0.21, 0.25], [0, 0.25]], 12), plastic(0xd9892b))
  const label = mesh(cyl(0.212, 0.212, 0.45, 12), paper(0xf6f4ee), [0, -0.1, 0])
  const stripe = mesh(cyl(0.212, 0.212, 0.07, 12), paper(0xc23b32), [0, 0.155, 0])
  const dosageBar = mesh(bx(0.04, 0.16, 0.01), paper(0x2a2a2a), [0, -0.1, 0.207])
  const dosageNotch = mesh(bx(0.16, 0.03, 0.01), paper(0x2a2a2a), [0, -0.02, 0.207])
  const cap = mesh(cyl(0.225, 0.225, 0.2, 12), plastic(0xf2f2f2), [0, 0.35, 0])
  return G(bottle, label, stripe, dosageBar, dosageNotch, cap)
}
