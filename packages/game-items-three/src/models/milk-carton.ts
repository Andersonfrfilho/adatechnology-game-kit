import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `milk_carton`.
 */
export const milkCarton: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, paper, plastic }) => {
  const white = paper(0xf3f2ec)
  const body = mesh(bx(0.7, 1.3, 0.7), white, [0, -0.35, 0])
  const gable = mesh(extrude([[-0.35, 0], [0.35, 0], [0.025, 0.5], [-0.025, 0.5]], 0.7, 0), white, [0, 0.3, -0.35])
  const fin = mesh(bx(0.05, 0.2, 0.7), paper(0xd9d8d0), [0, 0.9, 0])
  const frontPanel = mesh(bx(0.5, 0.6, 0.012), paper(0x2f6fc0), [0, -0.3, 0.345])
  const backPanel = mesh(bx(0.5, 0.6, 0.012), paper(0x2f6fc0), [0, -0.3, -0.345])
  const baseStripe = mesh(bx(0.5, 0.08, 0.012), paper(0xf3f2ec), [0, -0.55, 0.347])
  const spout = mesh(cyl(0.07, 0.07, 0.04, 8), plastic(0xd23b3b), [0.2, 0.558, 0], [0, 0, -0.995])
  return G(body, gable, fin, frontPanel, backPanel, baseStripe, spout)
}
