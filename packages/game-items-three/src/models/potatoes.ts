import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `potatoes`.
 */
export const potatoes: ItemModelBuilder = ({ T, mesh, bx, G, food }) => {
  const skin = food(0xb08a55)
  const ball = new T.SphereGeometry(0.5, 8, 5)
  const eye = food(0x6b4f2a)
  return G(
    mesh(ball, skin, [-0.5, 0, -0.3], [0, 0, 0], [1.0, 0.9, 0.8]),
    mesh(ball, food(0xa57e4a), [0.5, -0.03, -0.3], [0, 0, 0], [1.0, 0.8, 0.8]),
    mesh(ball, food(0xbf9a63), [0, -0.03, 0.3], [0, 0, 0], [1.0, 0.8, 0.8]),
    mesh(bx(0.08, 0.05, 0.08), eye, [-0.6, 0.4, -0.3]),
    mesh(bx(0.08, 0.05, 0.08), eye, [0.4, 0.34, -0.3]),
    mesh(bx(0.08, 0.05, 0.08), eye, [0.1, 0.34, 0.3]),
  )
}
