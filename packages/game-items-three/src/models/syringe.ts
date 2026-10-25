import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `syringe`.
 */
export const syringe: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, metal, glass }) => {
  const along = [0, 0, Math.PI / 2] as const
  const alongTip = [0, 0, -Math.PI / 2] as const
  const barrel = mesh(cyl(0.075, 0.075, 0.7, 10), glass(0xcfe8f0, 0.55), [-0.1, 0, 0], along)
  const flange = mesh(cyl(0.1, 0.1, 0.025, 12), plastic(0xe8eef0), [-0.45, 0, 0], along)
  const stopper = mesh(cyl(0.07, 0.07, 0.07, 8), plastic(0x2b2b2b), [-0.3, 0, 0], along)
  const rod = mesh(cyl(0.022, 0.022, 0.5, 6), plastic(0xe8eef0), [-0.475, 0, 0], along)
  const thumbRest = mesh(cyl(0.09, 0.09, 0.025, 10), plastic(0xe8eef0), [-0.7375, 0, 0], along)
  const hub = mesh(cyl(0.025, 0.06, 0.1, 8), plastic(0xf0f0f0), [0.3, 0, 0], alongTip)
  const needle = mesh(cyl(0.012, 0.012, 0.4, 6), metal(0xc9ced3), [0.55, 0, 0], along)
  const marks = [-0.3, -0.1, 0.1].map((x) => mesh(bx(0.012, 0.15, 0.15), plastic(0x2a6fb5), [x, 0, 0]))
  return G(barrel, flange, stopper, rod, thumbRest, hub, needle, ...marks)
}
