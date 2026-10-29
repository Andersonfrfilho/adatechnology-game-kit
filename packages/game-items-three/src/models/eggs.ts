import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `eggs`.
 */
export const eggs: ItemModelBuilder = ({ T, mesh, bx, G, paper, food }) => {
  const egg = new T.SphereGeometry(0.5, 8, 4)
  const carton = paper(0xb8a98f)
  const eggs = [-0.8, 0, 0.8].flatMap((x) => [-0.25, 0.25].map((z, row) => mesh(egg, food(row ? 0xd9bd8d : 0xe6d3b0), [x, 0.05, z], [0, 0, 0], [0.5, 0.6, 0.5])))
  return G(
    mesh(bx(2.5, 0.2, 1.0), carton, [0, -0.25, 0]),
    ...eggs,
    mesh(bx(0.05, 0.18, 1.0), carton, [-0.4, -0.06, 0]),
    mesh(bx(0.05, 0.18, 1.0), carton, [0.4, -0.06, 0]),
    mesh(bx(2.5, 0.12, 0.04), carton, [0, -0.1, 0.48]),
  )
}
