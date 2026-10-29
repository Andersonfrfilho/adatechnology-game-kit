import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sickle`.
 */
export const sickle: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, wood, cloth }) => {
  const R = Math.PI / 2
  const steel = metal(0xa5a9ad)
  const blade = (x1: number, z1: number, x2: number, z2: number, width: number) =>
    mesh(bx(Math.hypot(x2 - x1, z2 - z1), 0.06, width), steel, [(x1 + x2) / 2, 0, (z1 + z2) / 2], [0, Math.atan2(-(z2 - z1), x2 - x1), 0])
  return G(
    mesh(cyl(0.15, 0.17, 1.5, 8), wood(0x7a5a38), [-1.25, 0, -1.575], [0, 0, R]),
    mesh(cyl(0.176, 0.176, 0.5, 8), cloth(0x3b2a20), [-1.7, 0, -1.575], [0, 0, R]),
    mesh(cyl(0.176, 0.176, 0.2, 8), metal(0x6f7377), [-0.6, 0, -1.575], [0, 0, R]),
    blade(-0.5, -1.575, 0.3, -1.5, 0.18),
    blade(0.3, -1.5, 1.2, -1.1, 0.24),
    blade(1.2, -1.1, 1.75, -0.35, 0.28),
    blade(1.75, -0.35, 1.88, 0.5, 0.26),
    blade(1.88, 0.5, 1.5, 1.2, 0.2),
    blade(1.5, 1.2, 0.9, 1.7, 0.12),
  )
}
