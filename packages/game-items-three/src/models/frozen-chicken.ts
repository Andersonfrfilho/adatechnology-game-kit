import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `frozen_chicken`.
 */
export const frozenChicken: ItemModelBuilder = ({ T, mesh, bx, cyl, G, plastic, glass, food }) => {
  const ball = new T.SphereGeometry(0.5, 8, 5)
  const small = new T.SphereGeometry(0.5, 6, 4)
  const skin = food(0xe6c7a0)
  const leg = (z: number) => [
    mesh(cyl(0.1, 0.17, 0.7, 8), skin, [0.8, -0.02, z], [0, 0, -1.37]),
    mesh(small, food(0xefe0c8), [1.18, 0.02, z], [0, 0, 0], [0.22, 0.2, 0.22]),
  ]
  return G(
    mesh(bx(2.6, 1.0, 1.7), glass(0xcfe3ee, 0.3)),
    mesh(ball, skin, [-0.25, -0.05, 0], [0, 0, 0], [1.7, 0.7, 1.1]),
    mesh(small, food(0xd6a97f), [-0.1, 0.18, 0], [0, 0, 0], [1.0, 0.3, 0.7]),
    ...leg(0.45),
    ...leg(-0.45),
    mesh(small, skin, [-0.55, 0.05, 0.62], [0, 0, 0], [0.8, 0.3, 0.35]),
    mesh(small, skin, [-0.55, 0.05, -0.62], [0, 0, 0], [0.8, 0.3, 0.35]),
    mesh(bx(2.6, 0.14, 0.05), plastic(0x7fa7c4), [0, 0.43, 0.8]),
  )
}
