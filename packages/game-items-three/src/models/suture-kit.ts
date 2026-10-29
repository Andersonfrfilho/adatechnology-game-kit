import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `suture_kit`.
 */
export const sutureKit: ItemModelBuilder = ({ mesh, bx, torus, G, plastic, metal, paper }) => {
  const lower = mesh(bx(1.5, 0.8, 0.15), plastic(0x2d5a7b), [0, 0, -0.075])
  const lid = mesh(bx(1.5, 0.8, 0.15), plastic(0x3d7aa3), [0, 0, 0.075])
  const latch = mesh(bx(0.2, 0.14, 0.304), metal(0xc2c7cc), [0.62, 0.0, 0])
  const label = mesh(bx(0.7, 0.34, 0.01), paper(0xf4f4f0), [-0.2, -0.1, 0.1455])
  const needle = mesh(torus(0.12, 0.018, 4.2), metal(0xd7dbe0), [-0.2, 0.1, 0.135])
  const thread = mesh(bx(0.5, 0.02, 0.01), paper(0x1c1c1c), [-0.2, -0.1, 0.1465])
  return G(lower, lid, latch, label, needle, thread)
}
