import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `saline_iv_bag`.
 */
export const salineIvBag: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, plastic, paper, glass, metal }) => {
  const bag = mesh(extrude([[-0.58, -0.8], [-0.5, -0.98], [0.5, -0.98], [0.58, -0.8], [0.58, 0.8], [0.5, 0.98], [-0.5, 0.98], [-0.58, 0.8]], 0.41, 0.02), glass(0xd7eef4, 0.5), [0, 0, -0.205])
  const header = mesh(bx(1.0, 0.25, 0.08), plastic(0xe4eef1), [0, 1.125, 0])
  const hangHole = mesh(bx(0.3, 0.1, 0.084), plastic(0x3a4a52), [0, 1.14, 0])
  const label = mesh(bx(0.8, 0.6, 0.02), paper(0xf6f9fa), [0, 0.1, 0.2135])
  const band = mesh(bx(0.82, 0.12, 0.02), paper(0x2f80c8), [0, 0.25, 0.2145])
  const adminPort = mesh(cyl(0.12, 0.09, 0.25, 8), plastic(0x2f80c8), [-0.25, -1.125, 0])
  const injectionPort = mesh(cyl(0.1, 0.07, 0.25, 8), metal(0x3a3a3a), [0.25, -1.125, 0])
  return G(bag, header, hangHole, label, band, adminPort, injectionPort)
}
