import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bread`.
 */
export const bread: ItemModelBuilder = ({ T, mesh, bx, G, food }) => {
  const score = food(0xe0b070)
  return G(
    mesh(new T.SphereGeometry(0.5, 12, 6), food(0xa86a2c), [0, 0, 0], [0, 0, 0], [3.0, 1.0, 1.0]),
    mesh(bx(0.6, 0.03, 0.09), score, [-0.7, 0.4, 0], [0, 0.7, 0]),
    mesh(bx(0.6, 0.03, 0.09), score, [0, 0.485, 0], [0, 0.7, 0]),
    mesh(bx(0.6, 0.03, 0.09), score, [0.7, 0.4, 0], [0, 0.7, 0]),
  )
}
