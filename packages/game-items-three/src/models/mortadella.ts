import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `mortadella`.
 */
export const mortadella: ItemModelBuilder = ({ mesh, cyl, bx, G, food }) => {
  const pink = food(0xd98a8a)
  const fat = food(0xf1e4d4)
  const nut = food(0x7a9a4a)
  return G(
    mesh(cyl(0.25, 0.25, 1.2, 12), food(0xc27a74), [-0.15, 0, 0], [0, 0, Math.PI / 2], [1.2, 1, 1]),
    mesh(cyl(0.25, 0.25, 0.05, 12), pink, [0.48, 0, 0.0], [0, 0, Math.PI / 2], [1.2, 1, 1]),
    mesh(cyl(0.25, 0.25, 0.05, 12), pink, [0.62, 0.0, 0], [0, 0, Math.PI / 2], [1.2, 1, 1]),
    mesh(cyl(0.25, 0.25, 0.05, 12), pink, [0.73, 0.0, 0], [0, 0, Math.PI / 2], [1.2, 1, 1]),
    mesh(bx(0.012, 0.07, 0.07), fat, [0.76, 0.1, 0.05]),
    mesh(bx(0.012, 0.07, 0.07), fat, [0.76, -0.1, -0.06]),
    mesh(bx(0.012, 0.05, 0.05), nut, [0.76, 0.0, 0.0]),
  )
}
