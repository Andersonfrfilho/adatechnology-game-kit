import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `slingshot`.
 */
export const slingshot: ItemModelBuilder = ({ mesh, cyl, bx, G, wood, cloth }) => {
  const rod = (x1: number, y1: number, x2: number, y2: number, radius: number) =>
    [cyl(radius, radius, Math.hypot(x2 - x1, y2 - y1), 8), [(x1 + x2) / 2, (y1 + y2) / 2, 0], [0, 0, Math.atan2(-(x2 - x1), y2 - y1)]] as const
  const frame = wood(0x6b4a2c)
  const band = cloth(0x1f1f1f)
  const arms = [-1, 1].map((side) => rod(0, -0.15, side * 0.5675, 0.70, 0.1))
  const bands = [-1, 1].map((side) => rod(side * 0.5675, 0.70, side * 0.12, 0.25, 0.03))
  return G(
    mesh(cyl(0.12, 0.1, 0.65, 8), frame, [0, -0.425, 0]),
    mesh(cyl(0.126, 0.126, 0.3, 8), cloth(0x7a2f1f), [0, -0.5, 0]),
    ...arms.map(([geometry, position, rotation]) => mesh(geometry, frame, [...position], [...rotation])),
    ...bands.map(([geometry, position, rotation]) => mesh(geometry, band, [...position], [...rotation])),
    mesh(bx(0.26, 0.2, 0.05), cloth(0x8a5a35), [0, 0.2, 0]),
  )
}
