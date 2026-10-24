import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `exam_gloves`.
 */
export const examGloves: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const pack = mesh(bx(1.0, 1.2, 0.1), paper(0x2a70b8))
  const graphic = mesh(bx(0.7, 0.7, 0.098), paper(0xffffff))
  return G(pack, graphic)
}
