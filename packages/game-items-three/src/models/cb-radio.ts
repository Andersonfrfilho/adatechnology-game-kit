import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cbRadio: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const quarter = Math.PI / 2
  const group = G(
    mesh(bx(0.22, 0.006, 0.194), metal(0x1f2124), [0, 0.003, -0.003]),
    mesh(bx(0.25, 0.068, 0.194), metal(0x35383b), [0, 0.04, -0.003]),
    mesh(bx(0.06, 0.02, 0.002), M(0xd9a441, 'glass', { emissive: 0x6a4a10, emissiveIntensity: 0.6 }), [0.06, 0.052, 0.095]),
    mesh(cyl(0.016, 0.016, 0.006, 10), plastic(0x15171a), [-0.08, 0.04, 0.097], [quarter, 0, 0]),
    mesh(cyl(0.016, 0.016, 0.006, 10), plastic(0x15171a), [-0.03, 0.04, 0.097], [quarter, 0, 0]),
    mesh(cyl(0.008, 0.008, 0.006, 8), metal(0x8d9094), [0.09, 0.025, 0.097], [quarter, 0, 0]),
  )
  for (const z of [-0.07, -0.045, -0.02]) group.add(mesh(bx(0.2, 0.006, 0.01), metal(0x1f2124), [0, 0.077, z]))
  return group
}
