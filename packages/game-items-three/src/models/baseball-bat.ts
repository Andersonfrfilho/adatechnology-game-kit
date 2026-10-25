import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `baseball_bat`.
 */
export const baseballBat: ItemModelBuilder = ({ mesh, lathe, cyl, G, wood, cloth }) => {
  const R = Math.PI / 2
  const profile: Array<[number, number]> = [[0, -4.3], [0.19, -4.3], [0.25, -4.2], [0.22, -4.05], [0.14, -3.95], [0.14, -3.0], [0.17, -1.6], [0.25, 0.2], [0.3, 1.8], [0.345, 3.0], [0.345, 4.0], [0.31, 4.25], [0, 4.3]]
  const band = cloth(0x8f1f1f)
  return G(
    mesh(lathe(profile, 16), wood(0xc9a56b), [0, 0, 0], [0, 0, -R]),
    mesh(cyl(0.185, 0.185, 2.2, 8), cloth(0x1b1c1d), [-2.8, 0, 0], [0, 0, R]),
    mesh(cyl(0.352, 0.352, 0.12, 16), band, [3.2, 0, 0], [0, 0, R]),
    mesh(cyl(0.352, 0.352, 0.12, 16), band, [3.55, 0, 0], [0, 0, R]),
  )
}
