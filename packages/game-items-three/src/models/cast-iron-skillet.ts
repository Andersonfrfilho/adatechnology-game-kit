import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cast_iron_skillet`.
 */
export const castIronSkillet: ItemModelBuilder = ({ mesh, lathe, cyl, G, metal }) => {
  const R = Math.PI / 2
  const iron = metal(0x2b2c2e)
  const pan = lathe([[0, -0.25], [0.95, -0.25], [1.25, 0.25], [1.1, 0.25], [0.92, -0.1], [0, -0.1]], 16)
  return G(
    mesh(pan, iron, [-0.9, 0, 0]),
    mesh(cyl(0.9, 0.9, 0.01, 16), metal(0x1c1d1f), [-0.9, -0.095, 0]),
    mesh(cyl(0.14, 0.1, 1.95, 8), iron, [1.175, 0.1, 0], [0, 0, R]),
    mesh(cyl(0.06, 0.06, 0.22, 8), metal(0x111213), [2.0, 0.1, 0]),
    mesh(cyl(0.1, 0.1, 0.16, 8), iron, [-2.0, 0.12, 0], [0, 0, R]),
  )
}
