import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `multivitamin`.
 */
export const multivitamin: ItemModelBuilder = ({ mesh, cyl, lathe, G, plastic, paper }) => {
  const bottle = mesh(lathe([[0, -0.45], [0.22, -0.45], [0.248, -0.41], [0.248, 0.15], [0.2, 0.24], [0.17, 0.26], [0, 0.26]], 12), plastic(0xc9791a))
  const label = mesh(cyl(0.25, 0.25, 0.42, 12), paper(0xf6f1e2), [0, -0.14, 0])
  const stripe = mesh(cyl(0.25, 0.25, 0.06, 12), paper(0x3f9e55), [0, 0.11, 0])
  const collar = mesh(cyl(0.2, 0.2, 0.03, 12), plastic(0xe8e8e8), [0, 0.265, 0])
  const cap = mesh(cyl(0.19, 0.19, 0.19, 12), plastic(0x3f9e55), [0, 0.355, 0])
  return G(bottle, label, stripe, collar, cap)
}
