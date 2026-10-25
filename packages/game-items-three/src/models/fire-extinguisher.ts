import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `fire_extinguisher`.
 */
export const fireExtinguisher: ItemModelBuilder = ({ mesh, bx, cyl, G, M, metal, plastic, paper }) => {
  const red = metal(0xb3261e)
  const brass = metal(0x9a8a4a)
  const hose = plastic(0x1f2022)
  return G(
    mesh(cyl(7, 7, 34, 12), red, [0, -7, 0]),
    mesh(cyl(8, 8, 2, 12), hose, [0, -23, 0]),
    mesh(cyl(7.1, 7.1, 10, 12), paper(0xe8e4d8), [0, -8, 0]),
    mesh(cyl(2.8, 7, 5, 12), red, [0, 12.5, 0]),
    mesh(cyl(2.2, 2.2, 4, 8), brass, [0, 17, 0]),
    mesh(bx(6, 4, 4), brass, [0, 21, 0]),
    mesh(bx(8, 1, 2.4), red, [0, 23.5, 0]),
    mesh(cyl(0.7, 0.7, 5, 8), hose, [5.5, 20, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(0.7, 0.7, 16, 8), hose, [7.3, 12, 0]),
    mesh(cyl(0.9, 0.9, 1.5, 6), metal(0x3c3f43), [7.3, 3.2, 0]),
    mesh(cyl(1.4, 1.4, 0.8, 8), M(0xe8e4d8, 'metal', { metalness: 0.3, roughness: 0.4 }), [-1.5, 21, 2.2], [Math.PI / 2, 0, 0]),
  )
}
