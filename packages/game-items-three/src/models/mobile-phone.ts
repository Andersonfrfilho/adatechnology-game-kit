import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const mobilePhone: ItemModelBuilder = ({ M, mesh, bx, G, plastic, glass }) =>
  G(
    mesh(bx(0.077, 0.16, 0.0082), plastic(0x23262b), [0, 0.08, 0]),
    mesh(bx(0.07, 0.15, 0.0004), glass(0x0c1118, 0.95), [0, 0.08, 0.0043]),
    mesh(bx(0.026, 0.026, 0.0004), plastic(0x15171a), [-0.02, 0.14, -0.0043]),
    mesh(bx(0.016, 0.002, 0.0004), M(0x3b4048, 'plastic'), [0, 0.153, 0.0043]),
  )
