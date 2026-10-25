import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pickaxe`.
 */
export const pickaxe: ItemModelBuilder = ({ T, mesh, cyl, bx, G, metal, wood, cloth }) => {
  const R = Math.PI / 2
  const iron = metal(0x55595d)
  const arm = (side: number) => [
    mesh(cyl(0.13, 0.2, 0.8, 8), iron, [4.1, 0, side * 0.65], [side * R, 0, 0]),
    mesh(new T.ConeGeometry(0.13, 0.7, 8), metal(0x6a6e72), [4.08, 0, side * 1.4], [side * R, 0, 0.18]),
  ]
  return G(
    mesh(cyl(0.17, 0.15, 8.6, 8), wood(0x8a643c), [-0.2, 0, 0], [0, 0, R]),
    mesh(cyl(0.19, 0.19, 2.0, 8), cloth(0x2b2b2b), [-3.4, 0, 0], [0, 0, R]),
    mesh(cyl(0.2, 0.2, 0.3, 8), wood(0x6f4f2e), [-4.35, 0, 0], [0, 0, R]),
    mesh(bx(0.8, 0.4, 0.5), iron, [4.1, 0, 0]),
    mesh(cyl(0.2, 0.2, 0.3, 8), metal(0x3a3d40), [3.45, 0, 0], [0, 0, R]),
    ...arm(1),
    ...arm(-1),
  )
}
