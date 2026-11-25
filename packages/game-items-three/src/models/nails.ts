import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `nails`.
 */
export const nails: ItemModelBuilder = ({ T, mesh, cyl, G, metal }) => {
  const R = Math.PI / 2
  const steel = metal(0x8d9096)
  const nail = (y: number, z: number, direction: number) => [
    mesh(cyl(0.1, 0.1, 0.04, 8), steel, [direction * 0.63, y, z], [0, 0, R]),
    mesh(cyl(0.035, 0.035, 1.1, 6), steel, [direction * 0.06, y, z], [0, 0, R]),
    mesh(new T.ConeGeometry(0.035, 0.16, 6), steel, [-direction * 0.57, y, z], [0, 0, direction * R]),
  ]
  // the upper pair lies on the lower one, none in the air: its shank on the lower nail's head, its head on the lower shank (head radius 0.1 + shank radius 0.035)
  const LOW = -0.0675
  const HIGH = LOW + 0.135
  return G(...nail(LOW, -0.15, 1), ...nail(LOW, 0.15, -1), ...nail(HIGH, -0.15, -1), ...nail(HIGH, 0.15, 1))
}
