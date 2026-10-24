import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `fire_extinguisher`.
 */
export const fireExtinguisher: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) => {
  const tank = mesh(cyl(0.8, 0.8, 4.8, 16), metal(0xcc1111))
  const nozzle = mesh(bx(0.3, 0.5, 0.8), plastic(0x111111), [0, 2.15, 0.3])
  return G(tank, nozzle)
}
