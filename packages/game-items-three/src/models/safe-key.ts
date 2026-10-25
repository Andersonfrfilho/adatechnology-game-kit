import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const safeKey: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const brass = metal(0xb08a2e)
  const parts = [
    mesh(bx(0.046, 0.01, 0.005), brass, [0.012, 0.0125, 0]),
    mesh(bx(0.004, 0.016, 0.005), brass, [-0.01, 0.0125, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.0, 0.0055, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.01, 0.0055, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.02, 0.0055, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.0315, 0.0055, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.0, 0.0195, 0]),
    mesh(bx(0.006, 0.004, 0.005), brass, [0.015, 0.0195, 0]),
  ]
  const segments = 8
  for (let index = 0; index < segments; index++) {
    const angle = (2 * Math.PI * index) / segments
    parts.push(mesh(bx(0.0066, 0.0045, 0.005), brass, [-0.0225 + 0.0102 * Math.cos(angle), 0.0125 + 0.0102 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  return G(...parts)
}
