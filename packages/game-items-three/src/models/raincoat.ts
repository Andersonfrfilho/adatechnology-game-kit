import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const raincoat: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, metal }) => {
  const sheet = plastic(0xd2a91c)
  const trim = plastic(0xa8851a)
  return G(
    mesh(bx(0.2, 0.03, 0.25), sheet, [0, 0.015, 0]),
    mesh(bx(0.05, 0.026, 0.17), sheet, [-0.125, 0.013, -0.04]),
    mesh(bx(0.05, 0.026, 0.17), sheet, [0.125, 0.013, -0.04]),
    mesh(bx(0.05, 0.03, 0.012), trim, [-0.125, 0.015, 0.05]),
    mesh(bx(0.05, 0.03, 0.012), trim, [0.125, 0.015, 0.05]),
    mesh(cyl(0.055, 0.055, 0.01, 12), trim, [0, 0.035, -0.07]),
    mesh(bx(0.014, 0.01, 0.17), trim, [0, 0.035, 0.04]),
    mesh(cyl(0.006, 0.006, 0.012, 6), metal(0x8a8d90), [0, 0.034, 0.0]),
    mesh(cyl(0.006, 0.006, 0.012, 6), metal(0x8a8d90), [0, 0.034, 0.06]),
  )
}
