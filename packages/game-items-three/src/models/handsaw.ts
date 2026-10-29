import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `handsaw`.
 */
export const handsaw: ItemModelBuilder = ({ mesh, bx, extrude, G, metal, wood }) => {
  const grip = wood(0x7a4f2c)
  return G(
    mesh(bx(11, 3.5, 2.2), grip, [-19.5, 0, 5.4]),
    mesh(bx(11, 3.5, 2.2), grip, [-19.5, 0, -5.4]),
    mesh(bx(2.2, 3.5, 13), grip, [-23.9, 0, 0]),
    mesh(bx(2.4, 3.5, 13), grip, [-15.2, 0, 0]),
    mesh(extrude([[-14, 6.5], [25, 6.5], [25, 2], [-14, -6.5]], 0.3, 0.01), metal(0xaeb2b7), [0, 0.15, 0], [Math.PI / 2, 0, 0]),
  )
}
