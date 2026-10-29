import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `game_meat`.
 */
export const gameMeat: ItemModelBuilder = ({ T, mesh, cyl, G, food }) => {
  const ball = new T.SphereGeometry(0.5, 8, 6)
  const knob = new T.SphereGeometry(0.5, 6, 4)
  const bone = food(0xe6dcc3)
  return G(
    mesh(ball, food(0x7a2a24), [-0.4, 0, 0], [0, 0, 0], [2.2, 0.8, 2.0]),
    mesh(ball, food(0xc9a37a), [-0.5, 0.1, -0.3], [0, 0, 0], [1.4, 0.6, 1.0]),
    mesh(ball, food(0x5c1d1a), [-0.2, -0.05, 0.5], [0, 0, 0], [1.0, 0.6, 0.6]),
    mesh(cyl(0.11, 0.14, 0.9, 8), bone, [1.05, 0, 0], [0, 0, Math.PI / 2]),
    mesh(knob, bone, [1.35, 0.1, 0], [0, 0, 0], [0.3, 0.4, 0.4]),
    mesh(knob, bone, [1.35, -0.1, 0], [0, 0, 0], [0.3, 0.4, 0.4]),
    mesh(cyl(0.25, 0.25, 0.06, 8), food(0x3a2a22), [0.62, 0, 0], [0, 0, Math.PI / 2]),
  )
}
