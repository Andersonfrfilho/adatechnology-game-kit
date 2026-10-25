import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const rollingSuitcase: ItemModelBuilder = ({ mesh, cyl, bx, G, plastic }) => {
  const shell = plastic(0x3d4a5c)
  const trim = plastic(0x1f2226)
  const parts = [
    mesh(bx(0.4, 0.55, 0.25), shell, [0, 0.325, 0]),
    mesh(bx(0.012, 0.5, 0.25), trim, [-0.1, 0.325, 0]),
    mesh(bx(0.012, 0.5, 0.25), trim, [0.1, 0.325, 0]),
    mesh(bx(0.012, 0.04, 0.012), trim, [-0.06, 0.62, 0]),
    mesh(bx(0.012, 0.04, 0.012), trim, [0.06, 0.62, 0]),
    mesh(bx(0.15, 0.02, 0.03), trim, [0, 0.64, 0]),
    mesh(bx(0.12, 0.03, 0.04), trim, [0, 0.55, -0.1]),
  ]
  for (const x of [-0.15, 0.15]) for (const z of [-0.09, 0.09]) parts.push(mesh(cyl(0.025, 0.025, 0.02, 8), trim, [x, 0.025, z], [0, 0, Math.PI / 2]))
  return G(...parts)
}
