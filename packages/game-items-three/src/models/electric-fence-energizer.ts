import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const electricFenceEnergizer: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const quarter = Math.PI / 2
  const shell = plastic(0x34523b)
  const dark = plastic(0x1f2421)
  return G(
    mesh(bx(0.25, 0.17, 0.146), shell, [0, 0.1, 0]),
    mesh(bx(0.09, 0.06, 0.004), dark, [-0.04, 0.11, 0.075]),
    mesh(bx(0.06, 0.03, 0.004), M(0x9fd18b, 'glass', { emissive: 0x2f5a2a, emissiveIntensity: 0.5 }), [-0.04, 0.12, 0.0752]),
    mesh(cyl(0.016, 0.016, 0.004, 12), dark, [0.07, 0.115, 0.075], [quarter, 0, 0]),
    mesh(cyl(0.006, 0.006, 0.004, 8), M(0xb3261e, 'plastic', { emissive: 0x5a0f0c, emissiveIntensity: 0.6 }), [0.07, 0.07, 0.075], [quarter, 0, 0]),
    mesh(bx(0.13, 0.01, 0.016), metal(0x6d7073), [0, 0.195, 0]),
    mesh(bx(0.01, 0.005, 0.01), metal(0x6d7073), [-0.06, 0.1875, 0]),
    mesh(bx(0.01, 0.005, 0.01), metal(0x6d7073), [0.06, 0.1875, 0]),
    mesh(cyl(0.008, 0.008, 0.015, 8), metal(0xb4b7ba), [-0.07, 0.0075, 0]),
    mesh(cyl(0.008, 0.008, 0.015, 8), metal(0xb4b7ba), [0, 0.0075, 0]),
    mesh(cyl(0.008, 0.008, 0.015, 8), metal(0xb4b7ba), [0.07, 0.0075, 0]),
  )
}
