import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `povidone_iodine`.
 */
export const povidoneIodine: ItemModelBuilder = ({ mesh, cyl, lathe, G, glass, plastic, paper }) => {
  const bottle = mesh(lathe([[0, -0.55], [0.2, -0.55], [0.225, -0.5], [0.225, 0.15], [0.15, 0.28], [0.1, 0.33], [0.1, 0.34], [0, 0.34]], 12), glass(0x6b3a14, 0.85), [0, 0, 0], [0, 0, 0], [1, 1, 0.79])
  const label = mesh(cyl(0.2255, 0.2255, 0.4, 12), paper(0xf0e6cc), [0, -0.18, 0], [0, 0, 0], [1, 1, 0.79])
  const stripe = mesh(cyl(0.2255, 0.2255, 0.07, 12), paper(0xb5651d), [0, 0.0, 0], [0, 0, 0], [1, 1, 0.79])
  const cap = mesh(cyl(0.11, 0.11, 0.16, 10), plastic(0xf2f2f2), [0, 0.4, 0])
  const nozzle = mesh(cyl(0.03, 0.07, 0.07, 8), plastic(0xd8d8d8), [0, 0.515, 0])
  return G(bottle, label, stripe, cap, nozzle)
}
