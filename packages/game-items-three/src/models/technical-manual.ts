import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const technicalManual: ItemModelBuilder = ({ mesh, bx, G, paper, plastic }) => {
  const binder = plastic(0x2f3f52)
  const label = paper(0xe4dcc6)
  return G(
    mesh(bx(0.2, 0.292, 0.034), paper(0xe4dcc6), [0.004, 0.15, 0]),
    mesh(bx(0.21, 0.3, 0.003), binder, [0, 0.15, 0.0185]),
    mesh(bx(0.21, 0.3, 0.003), binder, [0, 0.15, -0.0185]),
    mesh(bx(0.012, 0.3, 0.04), binder, [-0.099, 0.15, 0]),
    mesh(bx(0.006, 0.18, 0.0004), label, [-0.0995, 0.15, 0.0202]),
    mesh(bx(0.12, 0.05, 0.0004), label, [0.01, 0.23, 0.0202]),
    mesh(bx(0.12, 0.004, 0.0004), plastic(0xb4b7ba), [0.01, 0.17, 0.0202]),
  )
}
