import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `car_jack`.
 */
export const carJack: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const steel = metal(0x5f6469)
  const dark = metal(0x3e4247)
  const arm = (x: number, y: number, angle: number, z: number) => mesh(bx(12.65, 1.2, 1.6), steel, [x, y, z], [0, 0, angle])
  const arms = [3.8, -3.8].flatMap((z) => [arm(-5.9, 2, 0.3217, z), arm(-5.9, -2, -0.3217, z), arm(5.9, 2, -0.3217, z), arm(5.9, -2, 0.3217, z)])
  return G(
    mesh(bx(8, 1, 11), dark, [0, -5, 0]),
    mesh(bx(8, 1, 11), dark, [0, 5, 0]),
    ...arms,
    mesh(cyl(0.6, 0.6, 30, 8), metal(0x8d9196), [0, 0, 0], [0, 0, Math.PI / 2]),
    mesh(bx(1.6, 2.4, 3), dark, [-11.8, 0, 0]),
    mesh(bx(1.6, 2.4, 3), dark, [11.8, 0, 0]),
    mesh(bx(1, 0.8, 5), metal(0xb5321f), [14.5, 0, 0]),
  )
}
