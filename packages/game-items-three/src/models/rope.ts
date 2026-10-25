import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rope`.
 */
export const rope: ItemModelBuilder = ({ mesh, cyl, bx, G, cloth }) => {
  const coil = mesh(cyl(0.75, 0.75, 0.8, 16), cloth(0xb49870))
  const band = mesh(bx(1.5, 0.2, 0.3), cloth(0xb49870))
  return G(coil, band)
}
