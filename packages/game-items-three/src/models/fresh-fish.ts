import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `fresh_fish`.
 */
export const freshFish: ItemModelBuilder = ({ T, mesh, bx, G, food, extrude }) => {
  const silver = food(0x9fb0b8)
  const eye = food(0x1c1c1c)
  return G(
    mesh(new T.SphereGeometry(0.5, 12, 6), silver, [0.0, 0, 0], [0, 0, 0], [3.0, 0.6, 1.0]),
    mesh(extrude([[0, 0], [-0.7, 0.4], [-0.7, -0.4]], 0.05, 0.01), food(0x7f939c), [-1.5 + 0.7, 0.025, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(0.8, 0.2, 0.08), food(0xe9eef0), [0.1, -0.12, 0.4]),
    mesh(bx(0.04, 0.2, 0.5), food(0x6c7f88), [0.75, 0.0, 0.0]),
    mesh(new T.SphereGeometry(0.06, 6, 4), eye, [1.2, 0.16, 0.12]),
  )
}
