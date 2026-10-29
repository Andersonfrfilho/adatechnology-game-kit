import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sterile_gauze`.
 */
export const sterileGauze: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const packet = mesh(bx(1.0, 1.0, 0.15), paper(0xeef3f5))
  const topSeal = mesh(bx(0.96, 0.08, 0.152), paper(0xc6d4da), [0, 0.46, 0])
  const bottomSeal = mesh(bx(0.96, 0.08, 0.152), paper(0xc6d4da), [0, -0.46, 0])
  const label = mesh(bx(0.6, 0.4, 0.01), paper(0x2f7fc1), [0, -0.05, 0.0705])
  const crossUpright = mesh(bx(0.07, 0.26, 0.01), paper(0xffffff), [0, -0.05, 0.0715])
  const crossArm = mesh(bx(0.26, 0.07, 0.01), paper(0xffffff), [0, -0.05, 0.0716])
  return G(packet, topSeal, bottomSeal, label, crossUpright, crossArm)
}
