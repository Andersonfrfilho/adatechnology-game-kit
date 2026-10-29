import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `screwdriver`.
 */
export const screwdriver: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const alongX = [0, 0, Math.PI / 2] as const
  const ring = plastic(0x1f2022)
  return G(
    mesh(cyl(1.9, 1.9, 8, 8), plastic(0xd4601c), [-7, 0, 0], alongX),
    mesh(cyl(2, 2, 0.5, 8), ring, [-10, 0, 0], alongX),
    mesh(cyl(2, 2, 0.5, 8), ring, [-8, 0, 0], alongX),
    mesh(cyl(2, 2, 0.5, 8), ring, [-6, 0, 0], alongX),
    mesh(cyl(1.2, 1.2, 2, 8), metal(0x9a9ea3), [-2, 0, 0], alongX),
    mesh(cyl(0.45, 0.45, 11, 8), metal(0x8d9196), [4.5, 0, 0], alongX),
    mesh(bx(1, 0.7, 0.12), metal(0x6f7378), [10.5, 0, 0]),
  )
}
