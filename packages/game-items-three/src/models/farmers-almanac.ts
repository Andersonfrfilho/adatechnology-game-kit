import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const farmersAlmanac: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const cover = paper(0x3f5a3a)
  return G(
    mesh(bx(0.1445, 0.206, 0.0116), paper(0xe4dcc6), [0.00025, 0.105, 0]),
    mesh(bx(0.15, 0.21, 0.0014), cover, [0, 0.105, 0.0065]),
    mesh(bx(0.15, 0.21, 0.0014), cover, [0, 0.105, -0.0065]),
    mesh(bx(0.003, 0.21, 0.015), cover, [-0.0735, 0.105, 0]),
    mesh(bx(0.09, 0.04, 0.0004), paper(0xe4dcc6), [0.005, 0.16, 0.0074]),
    mesh(bx(0.1, 0.004, 0.0004), paper(0xc9b36a), [0.005, 0.1, 0.0074]),
  )
}
