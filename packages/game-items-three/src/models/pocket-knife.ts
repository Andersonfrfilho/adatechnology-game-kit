import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pocket_knife`.
 */
export const pocketKnife: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0xb5b9be)
  return G(
    mesh(bx(7.5, 2.2, 3.2), plastic(0xb02a22), [-1.75, 0, 0]),
    mesh(bx(0.5, 2, 3), steel, [1.75, 0, 0]),
    mesh(bx(0.5, 2.1, 3.1), steel, [-5.25, 0, 0]),
    mesh(cyl(0.45, 0.45, 3.2, 8), metal(0x6b6f74), [1.2, 0, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(3.6, 0.3, 1.5), steel, [3.7, 0, 0]),
    mesh(bx(3.6, 0.15, 0.4), metal(0x8c9096), [3.7, 0.2, -0.55]),
  )
}
