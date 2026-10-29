import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `scrap_metal`.
 */
export const scrapMetal: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const R = Math.PI / 2
  return G(
    mesh(bx(2.0, 0.08, 1.1), metal(0x6e5a4a), [0, -0.36, -0.15]),
    mesh(bx(0.9, 0.5, 0.7), metal(0x7a4a2c), [0.55, -0.07, 0.15]),
    mesh(cyl(0.17, 0.17, 1.5, 8), metal(0x7a7f84), [-0.5, -0.15, 0], [R, 0, 0]),
    mesh(bx(1.2, 0.07, 0.9), metal(0x8a8f94), [0.1, 0.2, 0.05], [0, 0.4, 0.15]),
    mesh(cyl(0.32, 0.32, 0.1, 10), metal(0x4b4f54), [-0.4, 0.35, 0.15]),
    mesh(cyl(0.1, 0.1, 0.11, 6), metal(0x1c1d1f), [-0.4, 0.35, 0.15]),
  )
}
