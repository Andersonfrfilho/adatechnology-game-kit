import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `beans`.
 */
export const beans: ItemModelBuilder = ({ T, mesh, bx, G, cloth, paper, food }) => {
  const bean = new T.SphereGeometry(0.5, 6, 4)
  const dark = food(0x4a2418)
  return G(
    mesh(bx(1.0, 1.7, 0.58), cloth(0x8a5a2e), [0, -0.15, 0]),
    mesh(bx(1.0, 0.3, 0.34), cloth(0x70461f), [0, 0.85, 0]),
    mesh(bx(1.0, 0.05, 0.12), cloth(0x5a3716), [0, 0.975, 0]),
    mesh(bx(0.7, 0.8, 0.02), paper(0xe8d7b0), [0, -0.1, 0.3]),
    mesh(bean, dark, [-0.1, 0.0, 0.29], [0, 0, 0.6], [0.22, 0.14, 0.04]),
    mesh(bean, dark, [0.12, -0.1, 0.29], [0, 0, -0.5], [0.22, 0.14, 0.04]),
    mesh(bean, dark, [-0.05, -0.25, 0.29], [0, 0, 0.2], [0.22, 0.14, 0.04]),
  )
}
