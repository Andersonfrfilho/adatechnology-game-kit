import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `binoculars`.
 */
export const binoculars: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, glass }) => {
  const body = mesh(bx(1.8, 1.5, 1.2), plastic(0x222222))
  const lensL = mesh(cyl(0.25, 0.25, 0.02, 12), glass(0x336699, 0.8), [0.45, 0, 0.601], [Math.PI / 2, 0, 0])
  const lensR = mesh(cyl(0.25, 0.25, 0.02, 12), glass(0x336699, 0.8), [-0.45, 0, 0.601], [Math.PI / 2, 0, 0])
  return G(body, lensL, lensR)
}
