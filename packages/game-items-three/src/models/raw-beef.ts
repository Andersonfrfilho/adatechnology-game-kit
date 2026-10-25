import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `raw_beef`.
 */
export const rawBeef: ItemModelBuilder = ({ T, mesh, bx, G, plastic, food }) => {
  const ball = new T.SphereGeometry(0.5, 8, 6)
  return G(
    mesh(bx(2.0, 0.1, 1.5), plastic(0xf1f0eb), [0, -0.2, 0]),
    mesh(bx(2.0, 0.16, 0.08), plastic(0xf1f0eb), [0, -0.13, 0.71]),
    mesh(bx(2.0, 0.16, 0.08), plastic(0xf1f0eb), [0, -0.13, -0.71]),
    mesh(bx(0.08, 0.16, 1.34), plastic(0xf1f0eb), [0.96, -0.13, 0]),
    mesh(bx(0.08, 0.16, 1.34), plastic(0xf1f0eb), [-0.96, -0.13, 0]),
    mesh(ball, food(0xa3262a), [0, 0, 0], [0, 0.2, 0], [1.6, 0.5, 1.05]),
    mesh(ball, food(0xe9d6c1), [-0.35, 0.08, 0.3], [0, 0.4, 0], [0.7, 0.3, 0.3]),
    mesh(ball, food(0x7d1b20), [0.4, 0.09, -0.1], [0, 0.2, 0], [0.6, 0.3, 0.5]),
  )
}
