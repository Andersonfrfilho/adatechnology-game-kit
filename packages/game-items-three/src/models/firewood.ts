import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `firewood`.
 */
export const firewood: ItemModelBuilder = ({ mesh, cyl, G, wood }) => {
  const R = Math.PI / 2
  const log = (radius: number, y: number, z: number, bark: number) => [
    mesh(cyl(radius, radius, 3.98, 8), wood(bark), [0, y, z], [0, 0, R]),
    mesh(cyl(radius * 0.92, radius * 0.92, 0.02, 8), wood(0xd2b07a), [1.99, y, z], [0, 0, R]),
    mesh(cyl(radius * 0.92, radius * 0.92, 0.02, 8), wood(0xd2b07a), [-1.99, y, z], [0, 0, R]),
  ]
  return G(...log(0.4, -0.2, 0.4, 0x5a3d24), ...log(0.4, -0.2, -0.4, 0x6b4a2c), ...log(0.3, 0.3, 0, 0x4f3520))
}
