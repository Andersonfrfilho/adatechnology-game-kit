import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `screws`.
 */
export const screws: ItemModelBuilder = ({ T, mesh, cyl, bx, G, metal }) => {
  const R = Math.PI / 2
  const steel = metal(0xa9adb0)
  const dark = metal(0x2a2c2e)
  return G(
    mesh(cyl(0.25, 0.25, 0.12, 8), steel, [0.39, 0, 0], [0, 0, R]),
    mesh(bx(0.01, 0.3, 0.05), dark, [0.445, 0, 0]),
    mesh(bx(0.01, 0.05, 0.3), dark, [0.445, 0, 0]),
    mesh(cyl(0.08, 0.08, 0.58, 8), steel, [0.04, 0, 0], [0, 0, R]),
    mesh(new T.ConeGeometry(0.08, 0.2, 8), steel, [-0.35, 0, 0], [0, 0, R]),
    ...[-0.15, 0.05, 0.2].map((x) => mesh(cyl(0.1, 0.1, 0.04, 8), metal(0x8d9096), [x, 0, 0], [0, 0, R])),
  )
}
