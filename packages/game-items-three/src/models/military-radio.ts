import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const militaryRadio: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const quarter = Math.PI / 2
  const dark = plastic(0x1c1e1a)
  const group = G(
    mesh(bx(0.3, 0.14, 0.238), metal(0x4b5230), [0, 0.07, -0.006]),
    mesh(bx(0.08, 0.03, 0.002), M(0xa8d88f, 'glass', { emissive: 0x2f5a2a, emissiveIntensity: 0.5 }), [0.05, 0.1, 0.114]),
    mesh(cyl(0.02, 0.02, 0.016, 10), dark, [-0.08, 0.148, 0.04]),
    mesh(cyl(0.02, 0.02, 0.016, 10), dark, [-0.02, 0.148, 0.04]),
    mesh(cyl(0.018, 0.018, 0.018, 10), metal(0x2a2c2e), [0.1, 0.149, -0.08]),
    mesh(cyl(0.005, 0.008, 0.042, 6), metal(0x2a2c2e), [0.1, 0.179, -0.08]),
    mesh(bx(0.008, 0.015, 0.01), metal(0x2a2c2e), [-0.05, 0.1475, -0.06]),
    mesh(bx(0.008, 0.015, 0.01), metal(0x2a2c2e), [0.05, 0.1475, -0.06]),
    mesh(bx(0.108, 0.008, 0.01), metal(0x2a2c2e), [0, 0.155, -0.06]),
  )
  for (const x of [-0.08, 0, 0.08]) group.add(mesh(cyl(0.015, 0.015, 0.012, 8), metal(0x2a2c2e), [x, 0.045, 0.119], [quarter, 0, 0]))
  return group
}
