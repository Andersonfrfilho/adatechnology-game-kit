import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `exam_gloves`.
 */
export const examGloves: ItemModelBuilder = ({ mesh, bx, G, plastic, paper }) => {
  const nitrile = plastic(0x3a6ea5)
  const cuff = mesh(bx(0.6, 0.22, 0.1), plastic(0x2c557f), [0, -0.49, 0])
  const palm = mesh(bx(0.7, 0.5, 0.1), nitrile, [0, -0.15, 0])
  const pinky = mesh(bx(0.16, 0.34, 0.1), nitrile, [-0.2625, 0.27, 0])
  const ring = mesh(bx(0.16, 0.44, 0.1), nitrile, [-0.0875, 0.32, 0])
  const middle = mesh(bx(0.16, 0.5, 0.1), nitrile, [0.0875, 0.35, 0])
  const index = mesh(bx(0.16, 0.46, 0.1), nitrile, [0.2625, 0.33, 0])
  const thumb = mesh(bx(0.15, 0.38, 0.1), nitrile, [0.46, 0.0, 0], [0, 0, -1.0])
  const tag = mesh(bx(0.4, 0.1, 0.01), paper(0xf4f4f0), [0, -0.49, 0.0455])
  return G(cuff, palm, pinky, ring, middle, index, thumb, tag)
}
