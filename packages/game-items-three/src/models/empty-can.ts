import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `empty_can`.
 */
export const emptyCan: ItemModelBuilder = ({ mesh, cyl, G, metal }) => {
  const can = mesh(cyl(0.33, 0.33, 1.2, 16), metal(0xcccccc))
  const rim = mesh(cyl(0.332, 0.332, 0.04, 16), metal(0xaaaaaa), [0, 0.58, 0])
  const hole = mesh(cyl(0.12, 0.12, 0.01, 10), metal(0x222222), [0, 0.601, 0.08])
  return G(can, rim, hole)
}
