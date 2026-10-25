import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `ceftriaxone`.
 */
export const ceftriaxone: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, glass, metal, paper }) => {
  const tray = mesh(bx(1.0, 0.06, 0.3), plastic(0xdfe6ea), [0, -0.27, 0])
  const vials = [-0.35, 0, 0.35].flatMap((x) => [
    mesh(cyl(0.148, 0.148, 0.3, 8), glass(0xd8ecf2, 0.6), [x, -0.09, 0]),
    mesh(cyl(0.09, 0.148, 0.08, 8), glass(0xd8ecf2, 0.6), [x, 0.1, 0]),
    mesh(cyl(0.09, 0.09, 0.16, 8), metal(0xb9bec4), [x, 0.22, 0]),
    mesh(cyl(0.15, 0.15, 0.14, 8), paper(0xf2f0e6), [x, -0.1, 0]),
  ])
  return G(tray, ...vials)
}
