import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `crossbow`.
 */
export const crossbow: ItemModelBuilder = ({ mesh, bx, G, wood, metal, cloth }) => {
  const stock = wood(0x4a2f1a)
  const prod = metal(0x2f3236)
  const stringMaterial = cloth(0xe3ddc8)
  return G(
    mesh(bx(7, 0.5, 0.5), stock, [0, -0.35, 0]),
    mesh(bx(1.4, 0.9, 0.5), stock, [-2.8, -0.15, 0]),
    mesh(bx(5.4, 0.16, 0.3), wood(0x5d3d22), [0.3, -0.02, 0]),
    mesh(bx(0.8, 0.7, 0.6), metal(0x3a3d40), [2.9, 0, 0]),
    mesh(bx(0.4, 0.5, 4.0), prod, [2.8, 0.35, 2.0], [0, -0.12, 0]),
    mesh(bx(0.4, 0.5, 4.0), prod, [2.8, 0.35, -2.0], [0, 0.12, 0]),
    mesh(bx(0.05, 0.05, 4.07), stringMaterial, [1.98, 0.35, 1.95], [0, 0.289, 0]),
    mesh(bx(0.05, 0.05, 4.07), stringMaterial, [1.98, 0.35, -1.95], [0, -0.289, 0]),
    mesh(bx(3.6, 0.08, 0.08), wood(0xcdb68a), [1.2, 0.1, 0]),
  )
}
