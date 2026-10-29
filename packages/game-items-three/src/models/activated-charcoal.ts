import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `activated_charcoal`.
 */
export const activatedCharcoal: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper }) => {
  const black = plastic(0x1c1c1c)
  const body = mesh(bx(0.6, 0.65, 0.25), black, [0, -0.15, 0])
  const shoulder = mesh(bx(0.44, 0.1, 0.2), black, [0, 0.225, 0])
  const neck = mesh(cyl(0.1, 0.1, 0.1, 10), black, [0, 0.325, 0])
  const cap = mesh(cyl(0.12, 0.12, 0.1, 10), plastic(0xe8e8e8), [0, 0.425, 0])
  const label = mesh(bx(0.5, 0.36, 0.01), paper(0xf2f2ee), [0, -0.15, 0.1205])
  const title = mesh(bx(0.36, 0.06, 0.01), paper(0x1c1c1c), [0, -0.05, 0.1215])
  return G(body, shoulder, neck, cap, label, title)
}
