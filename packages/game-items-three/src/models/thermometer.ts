import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `thermometer`.
 */
export const thermometer: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, metal, glass }) => {
  const along = [0, 0, -Math.PI / 2] as const
  const body = mesh(bx(0.8, 0.19, 0.3), plastic(0xf2f4f5), [-0.2, 0, 0])
  const screen = mesh(bx(0.34, 0.01, 0.16), glass(0x9fc7a4, 0.9), [-0.3, 0.098, 0])
  const button = mesh(cyl(0.05, 0.05, 0.01, 10), plastic(0x2a8ad6), [0.0, 0.098, 0])
  const collar = mesh(cyl(0.07, 0.07, 0.04, 10), plastic(0xd4d9dc), [0.22, 0, 0], along)
  const probe = mesh(cyl(0.04, 0.06, 0.36, 10), metal(0xb7bcc2), [0.42, 0, 0], along)
  return G(body, screen, button, collar, probe)
}
