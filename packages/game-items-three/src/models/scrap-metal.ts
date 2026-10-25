import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `scrap_metal`.
 */
export const scrapMetal: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const plate = mesh(bx(2.0, 0.8, 1.5), metal(0x75523a))
  const pipe = mesh(cyl(0.15, 0.15, 1.3, 12), metal(0x555555), [0.1, 0, 0], [Math.PI / 2, 0, 0])
  return G(plate, pipe)
}
