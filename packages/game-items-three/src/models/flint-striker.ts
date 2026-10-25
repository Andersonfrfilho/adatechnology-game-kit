import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `flint_striker`.
 */
export const flintStriker: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, wood }) => {
  const alongX = [0, 0, Math.PI / 2] as const
  return G(
    mesh(cyl(1, 1, 5, 8), wood(0x6b4a2c), [-3, 0, 0], alongX, [1, 1, 0.75]),
    mesh(cyl(0.8, 0.8, 0.5, 8), metal(0x9a9ea3), [-5.25, 0, 0], alongX, [1, 1, 0.75]),
    mesh(cyl(0.9, 0.9, 0.6, 8), metal(0x9a9ea3), [-0.2, 0, 0], alongX, [1, 1, 0.75]),
    mesh(cyl(0.5, 0.5, 5.6, 8), metal(0x4a4d51), [2.8, 0.1, 0], alongX),
    mesh(bx(4, 0.2, 1.1), metal(0xb3b7bc), [3.4, -0.6, 0]),
  )
}
