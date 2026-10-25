import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `knife`.
 */
export const knife: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, metal, wood }) => {
  const R = Math.PI / 2
  const blade = extrude([[-1.25, 0.1], [-0.75, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.9, 0.2]], 0.06, 0.002)
  const rivet = metal(0xb8913a)
  return G(
    mesh(blade, metal(0xb4b8bb), [0, 0.03, 0], [R, 0, 0]),
    mesh(bx(0.1, 0.24, 0.38), metal(0x6f7377), [0.2, 0, 0]),
    mesh(bx(0.94, 0.294, 0.3), wood(0x5a3a22), [0.72, 0, 0]),
    mesh(bx(0.06, 0.28, 0.28), metal(0x6f7377), [1.22, 0, 0]),
    mesh(cyl(0.035, 0.035, 0.3, 8), rivet, [0.55, 0, 0]),
    mesh(cyl(0.035, 0.035, 0.3, 8), rivet, [0.95, 0, 0]),
  )
}
