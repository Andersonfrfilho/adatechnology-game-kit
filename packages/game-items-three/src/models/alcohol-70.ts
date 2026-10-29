import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `alcohol_70`.
 */
export const alcohol70: ItemModelBuilder = ({ mesh, cyl, lathe, G, glass, plastic, paper }) => {
  const slim = [1, 1, 0.714] as const
  const bottle = mesh(lathe([[0, -1], [0.31, -1], [0.35, -0.94], [0.35, 0.2], [0.25, 0.55], [0.12, 0.68], [0.12, 0.78], [0, 0.78]], 12), glass(0xe8f2f5, 0.6), [0, 0, 0], [0, 0, 0], slim)
  const label = mesh(cyl(0.351, 0.351, 0.8, 12), paper(0xf4f4f0), [0, -0.35, 0], [0, 0, 0], slim)
  const stripe = mesh(cyl(0.351, 0.351, 0.2, 12), paper(0xc23b32), [0, -0.1, 0], [0, 0, 0], slim)
  const cap = mesh(cyl(0.15, 0.15, 0.14, 10), plastic(0xf2f2f2), [0, 0.85, 0])
  const nozzle = mesh(cyl(0.04, 0.07, 0.08, 8), plastic(0xd8d8d8), [0, 0.96, 0])
  return G(bottle, label, stripe, cap, nozzle)
}
