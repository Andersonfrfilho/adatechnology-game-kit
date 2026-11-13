import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bucket`.
 */
export const bucket: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, metal }) => {
  const body = plastic(0x2c5f9e)
  const wire = metal(0x8a8d91)
  return G(
    mesh(cyl(13.6, 11.4, 22.5, 16), body, [0, -2, 0]),
    mesh(cyl(14, 14, 1.6, 16), plastic(0x234d82), [0, 8.7, 0]),
    mesh(cyl(11.8, 11.8, 1, 16), plastic(0x234d82), [0, -13, 0]),
    mesh(bx(0.6, 3.7, 0.6), wire, [13, 11.35, 0]),
    mesh(bx(0.6, 3.7, 0.6), wire, [-13, 11.35, 0]),
    mesh(bx(27.2, 0.5, 1.1), wire, [0, 13.25, 0]),
  )
}
