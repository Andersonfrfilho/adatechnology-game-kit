import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `camp_stove`.
 */
export const campStove: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0x4f5358)
  const grate = metal(0x2c2e30)
  const post = (x: number, z: number) => mesh(bx(0.8, 3, 0.8), grate, [x, 2.8, z])
  return G(
    mesh(bx(18, 3.6, 11), steel, [0, -3.2, 0]),
    mesh(cyl(3.6, 3.6, 1.8, 12), metal(0x8a8e93), [0, -0.5, 0]),
    mesh(cyl(2.4, 3, 1, 12), metal(0x2c2e30), [0, 0.9, 0]),
    mesh(cyl(1.1, 1.1, 1, 8), plastic(0xb5321f), [6, -3.2, 5], [Math.PI / 2, 0, 0]),
    post(6.8, 4), post(-6.8, 4), post(6.8, -4), post(-6.8, -4),
    mesh(bx(14, 0.8, 0.8), grate, [0, 4.6, 4]),
    mesh(bx(14, 0.8, 0.8), grate, [0, 4.6, -4]),
    mesh(bx(0.8, 0.8, 9), grate, [6.8, 4.6, 0]),
    mesh(bx(0.8, 0.8, 9), grate, [-6.8, 4.6, 0]),
  )
}
