import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `water_jug_5l`.
 */
export const waterJug5l: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic }) => {
  const jug = mesh(bx(1.9, 3.3, 1.5), plastic(0x90c5e8))
  const cap = mesh(cyl(0.24, 0.24, 0.2, 14), plastic(0x1565c0), [0, 1.55, 0])
  const handle = mesh(bx(0.25, 1.2, 0.5), plastic(0x1565c0), [0.75, 0.5, 0])
  return G(jug, cap, handle)
}
