import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `water_jug_5l`.
 */
export const waterJug5l: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper, glass }) => {
  const dark = plastic(0x1565c0)
  const body = mesh(bx(1.5, 2.3, 1.5), glass(0x9fd0ee, 0.75), [0, -0.5, 0])
  const shoulder = mesh(bx(1.2, 0.45, 1.2), glass(0x9fd0ee, 0.75), [0, 0.875, 0])
  const neck = mesh(cyl(0.34, 0.34, 0.3, 12), dark, [0, 1.25, 0])
  const cap = mesh(cyl(0.4, 0.4, 0.25, 12), dark, [0, 1.525, 0])
  const grip = mesh(bx(0.16, 0.9, 0.3), dark, [1.07, 0.6, 0])
  const upperBar = mesh(bx(0.45, 0.16, 0.3), dark, [0.925, 0.97, 0])
  const lowerBar = mesh(bx(0.45, 0.16, 0.3), dark, [0.925, 0.23, 0])
  const label = mesh(bx(1.0, 0.9, 0.02), paper(0xf4f6f8), [0, -0.5, 0.74])
  const band = mesh(bx(1.0, 0.2, 0.02), paper(0x2f80c8), [0, -0.3, 0.741])
  return G(body, shoulder, neck, cap, grip, upperBar, lowerBar, label, band)
}
