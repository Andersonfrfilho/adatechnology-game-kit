import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `baseball_bat`.
 */
export const baseballBat: ItemModelBuilder = ({ mesh, cyl, G, wood, cloth }) => {
  const bat = mesh(cyl(0.35, 0.35, 8.6, 16), wood(0xc49a62), [0, 0, 0], [0, 0, Math.PI / 2])
  const grip = mesh(cyl(0.352, 0.352, 2.0, 16), cloth(0x111111), [-3.0, 0, 0], [0, 0, Math.PI / 2])
  return G(bat, grip)
}
