import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const powerBank: ItemModelBuilder = ({ M, mesh, bx, G, plastic }) => {
  const led = M(0x8be3a0, 'plastic', { emissive: 0x2f7a45, emissiveIntensity: 0.6 })
  return G(
    mesh(bx(0.15, 0.07, 0.015), plastic(0x2d3138), [0, 0.035, 0]),
    mesh(bx(0.07, 0.024, 0.001), plastic(0x4a5058), [-0.025, 0.035, 0.0078]),
    mesh(bx(0.02, 0.008, 0.001), plastic(0x0f1012), [0.058, 0.058, 0.0078]),
    mesh(bx(0.012, 0.004, 0.001), led, [0.028, 0.02, 0.0078]),
    mesh(bx(0.012, 0.004, 0.001), led, [0.044, 0.02, 0.0078]),
    mesh(bx(0.012, 0.004, 0.001), led, [0.06, 0.02, 0.0078]),
  )
}
