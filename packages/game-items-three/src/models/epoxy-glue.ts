import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `epoxy_glue`.
 */
export const epoxyGlue: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, metal }) => {
  const card = mesh(bx(1.0, 0.6, 0.3), paper(0x1a457a))
  const tube1 = mesh(cyl(0.06, 0.06, 0.5, 12), metal(0xd0d0d0), [-0.2, 0, 0.08])
  const tube2 = mesh(cyl(0.06, 0.06, 0.5, 12), metal(0xd0d0d0), [0.2, 0, 0.08])
  return G(card, tube1, tube2)
}
