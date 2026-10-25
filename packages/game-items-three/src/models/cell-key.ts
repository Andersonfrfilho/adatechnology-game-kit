import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cellKey: ItemModelBuilder = ({ mesh, bx, cyl, G, metal }) => {
  const iron = metal(0x3b3b3d)
  const parts = [
    mesh(cyl(0.0035, 0.0035, 0.075, 8), iron, [0.0075, 0.015, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(0.006, 0.006, 0.008, 8), iron, [-0.03, 0.015, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(0.014, 0.012, 0.007), iron, [0.053, 0.009, 0]),
    mesh(bx(0.004, 0.005, 0.007), iron, [0.0485, 0.0025, 0]),
    mesh(bx(0.004, 0.005, 0.007), iron, [0.0575, 0.0025, 0]),
  ]
  const segments = 8
  for (let index = 0; index < segments; index++) {
    const angle = (2 * Math.PI * index) / segments
    parts.push(mesh(bx(0.0105, 0.005, 0.008), iron, [-0.045 + 0.0125 * Math.cos(angle), 0.015 + 0.0125 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  return G(...parts)
}
