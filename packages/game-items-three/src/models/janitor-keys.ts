import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const janitorKeys: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const steel = metal(0xa0a3a6)
  const brass = metal(0xb08a2e)
  const iron = metal(0x6a6d70)
  const parts = []
  const ringSegments = 10
  for (let index = 0; index < ringSegments; index++) {
    const angle = (2 * Math.PI * index) / ringSegments
    parts.push(mesh(bx(0.0105, 0.004, 0.004), steel, [0.0145 * Math.cos(angle), 0.0835 + 0.0145 * Math.sin(angle), 0], [0, 0, angle + Math.PI / 2]))
  }
  const keys = [
    { angle: -0.75, depth: -0.008, material: iron },
    { angle: -0.37, depth: -0.004, material: brass },
    { angle: 0, depth: 0, material: steel },
    { angle: 0.37, depth: 0.004, material: brass },
    { angle: 0.75, depth: 0.008, material: iron },
  ]
  for (const { angle, depth, material } of keys) {
    const key = G(
      mesh(bx(0.014, 0.014, 0.004), material, [0, 0, 0]),
      mesh(bx(0.006, 0.06, 0.004), material, [0, -0.037, 0]),
      mesh(bx(0.01, 0.006, 0.004), material, [0.004, -0.062, 0]),
      mesh(bx(0.01, 0.004, 0.004), material, [0.004, -0.052, 0]),
    )
    key.position.set(0.0165 * Math.sin(angle), 0.0835 - 0.0165 * Math.cos(angle), depth)
    key.rotation.z = angle
    parts.push(key)
  }
  return G(...parts)
}
