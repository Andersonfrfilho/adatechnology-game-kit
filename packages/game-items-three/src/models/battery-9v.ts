import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const battery9V: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) =>
  G(
    mesh(bx(0.026, 0.043, 0.018), plastic(0x1f2124), [0, 0.0215, 0]),
    mesh(bx(0.0262, 0.012, 0.0182), metal(0xb4b7ba), [0, 0.037, 0]),
    mesh(cyl(0.0045, 0.0045, 0.006, 8), metal(0xc8cacc), [0.006, 0.046, 0]),
    mesh(cyl(0.0035, 0.0035, 0.006, 8), metal(0xc8cacc), [-0.006, 0.046, 0]),
  )
