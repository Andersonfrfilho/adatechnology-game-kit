import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rebar`.
 */
export const rebar: ItemModelBuilder = ({ mesh, cyl, G, metal }) => {
  const bar = mesh(cyl(0.08, 0.08, 12.7, 16), metal(0x585c62), [0, 0, 0], [0, 0, Math.PI / 2])
  const rib1 = mesh(cyl(0.08, 0.08, 0.1, 16), metal(0x484c52), [-4, 0, 0], [0, 0, Math.PI / 2])
  const rib2 = mesh(cyl(0.08, 0.08, 0.1, 16), metal(0x484c52), [0, 0, 0], [0, 0, Math.PI / 2])
  const rib3 = mesh(cyl(0.08, 0.08, 0.1, 16), metal(0x484c52), [4, 0, 0], [0, 0, Math.PI / 2])
  return G(bar, rib1, rib2, rib3)
}
