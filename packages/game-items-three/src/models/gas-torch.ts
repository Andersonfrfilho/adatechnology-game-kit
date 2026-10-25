import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `gas_torch`.
 */
export const gasTorch: ItemModelBuilder = ({ mesh, cyl, bx, G, metal }) => {
  const tank = mesh(cyl(0.75, 0.75, 4.2, 16), metal(0x2255aa))
  const burner = mesh(bx(0.4, 0.5, 0.8), metal(0x999999), [0, 1.85, 0.3])
  return G(tank, burner)
}
