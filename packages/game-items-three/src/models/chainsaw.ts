import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `chainsaw`.
 */
export const chainsaw: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const orange = plastic(0xd9731c)
  const dark = plastic(0x2f3133)
  return G(
    mesh(bx(2.1, 1.2, 1.5), orange, [-1.2, -0.4, 0]),
    mesh(bx(1.3, 0.3, 1.1), dark, [-1.4, -1.15, 0]),
    mesh(bx(0.28, 0.85, 0.3), dark, [-2.1, 0.625, 0]),
    mesh(bx(0.28, 0.85, 0.3), dark, [-0.5, 0.625, 0]),
    mesh(bx(1.9, 0.25, 0.3), dark, [-1.3, 1.175, 0]),
    mesh(bx(0.2, 0.45, 2.3), dark, [-0.1, 0.45, 0]),
    mesh(cyl(0.38, 0.38, 0.12, 8), dark, [-1.2, 0.26, 0]),
    mesh(bx(0.8, 0.5, 0.3), metal(0x6f7377), [-1.5, -0.35, 0.9]),
    mesh(bx(2.2, 0.46, 0.14), metal(0xa9adb0), [1.0, -0.45, 0]),
    mesh(bx(2.35, 0.6, 0.2), metal(0x2a2c2e), [1.075, -0.45, 0]),
  )
}
