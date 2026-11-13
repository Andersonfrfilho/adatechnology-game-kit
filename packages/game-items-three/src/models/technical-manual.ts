import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const technicalManual: ItemModelBuilder = ({ mesh, bx, G, paper, plastic }) => {
  const binder = plastic(0x2f3f52)
  const label = paper(0xe4dcc6)
  return G(
    mesh(bx(0.196, 0.292, 0.029), paper(0xe4dcc6), [0.002, 0.15, 0]),
    mesh(bx(0.198, 0.3, 0.003), binder, [0.006, 0.15, 0.016]),
    mesh(bx(0.198, 0.3, 0.003), binder, [0.006, 0.15, -0.016]),
    mesh(bx(0.012, 0.3, 0.0385), binder, [-0.099, 0.15, -0.00075]),
    mesh(bx(0.006, 0.18, 0.003), label, [-0.0995, 0.15, 0.019]),
    mesh(bx(0.12, 0.05, 0.004), label, [0.01, 0.23, 0.0185]),
    mesh(bx(0.12, 0.004, 0.004), plastic(0xb4b7ba), [0.01, 0.17, 0.0185]),
  )
}
