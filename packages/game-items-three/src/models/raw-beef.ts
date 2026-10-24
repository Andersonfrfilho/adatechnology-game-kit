import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `raw_beef`.
 */
export const rawBeef: ItemModelBuilder = ({ mesh, bx, G, food, plastic, paper }) => {
  const tray = mesh(bx(2.0, 0.1, 1.5), plastic(0xffffff), [0, -0.2, 0])
  const meat = mesh(bx(1.8, 0.38, 1.3), food(0x8a1a1a), [0, 0.04, 0])
  const sticker = mesh(bx(0.5, 0.01, 0.4), paper(0xeeeeee), [0.4, 0.24, 0.2])
  return G(tray, meat, sticker)
}
