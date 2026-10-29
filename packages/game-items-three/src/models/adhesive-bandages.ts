import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `adhesive_bandages`.
 */
export const adhesiveBandages: ItemModelBuilder = ({ mesh, bx, G, metal, paper }) => {
  const body = mesh(bx(1.0, 0.54, 0.15), metal(0xd9dde0), [0, -0.03, 0])
  const lid = mesh(bx(1.0, 0.06, 0.15), metal(0x2a8ad6), [0, 0.27, 0])
  const label = mesh(bx(0.7, 0.34, 0.01), paper(0xf6f6f2), [0, -0.05, 0.0705])
  const crossUpright = mesh(bx(0.08, 0.24, 0.01), paper(0xd2312d), [0, -0.05, 0.0715])
  const crossArm = mesh(bx(0.24, 0.08, 0.01), paper(0xd2312d), [0, -0.05, 0.0716])
  return G(body, lid, label, crossUpright, crossArm)
}
