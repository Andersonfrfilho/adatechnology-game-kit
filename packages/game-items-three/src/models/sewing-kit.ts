import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sewing_kit`.
 */
export const sewingKit: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, cloth }) => {
  const box = mesh(bx(0.9, 0.5, 0.3), plastic(0x4488aa))
  const spool = mesh(cyl(0.08, 0.08, 0.2, 10), cloth(0xffffff), [0, 0, 0.05])
  return G(box, spool)
}
