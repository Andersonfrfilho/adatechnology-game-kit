import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `copper_wire`.
 */
export const copperWire: ItemModelBuilder = ({ mesh, lathe, cyl, G, metal, plastic }) => {
  const R = Math.PI / 2
  const copper = metal(0xb8693a)
  return G(
    mesh(lathe([[0.18, -0.11], [0.38, -0.11], [0.38, 0.11], [0.18, 0.11], [0.18, -0.11]], 16), copper),
    mesh(cyl(0.4, 0.4, 0.04, 16), plastic(0x2a2c2e), [0, 0.131, 0]),
    mesh(cyl(0.4, 0.4, 0.04, 16), plastic(0x2a2c2e), [0, -0.131, 0]),
    mesh(cyl(0.015, 0.015, 0.35, 6), metal(0xd08a55), [0, 0, 0.385], [0, 0, R]),
  )
}
