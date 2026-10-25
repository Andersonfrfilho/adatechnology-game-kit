import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const nightVisionGoggles: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const quarter = Math.PI / 2
  const shell = plastic(0x2e332b)
  const lens = M(0x1f3a24, 'glass', { emissive: 0x2f7a45, emissiveIntensity: 0.5 })
  const group = G(
    mesh(bx(0.12, 0.045, 0.05), shell, [0, 0.05, -0.005]),
    mesh(bx(0.08, 0.014, 0.06), shell, [0, 0.007, -0.005]),
    mesh(bx(0.04, 0.016, 0.05), metal(0x2a2c2e), [0, 0.092, -0.005]),
  )
  for (const x of [-0.039, 0.039]) {
    group.add(mesh(cyl(0.036, 0.036, 0.05, 12), shell, [x, 0.05, 0.03], [quarter, 0, 0]))
    group.add(mesh(cyl(0.028, 0.028, 0.002, 10), lens, [x, 0.05, 0.054], [quarter, 0, 0]))
    group.add(mesh(cyl(0.03, 0.03, 0.03, 10), plastic(0x15171a), [x, 0.05, -0.04], [quarter, 0, 0]))
  }
  return group
}
