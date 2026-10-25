import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const magazineArmGuard: ItemModelBuilder = ({ mesh, bx, G, paper, cloth }) => {
  const covers = [paper(0xb8b2a2), paper(0x8c9aa6), paper(0xa88a6e), paper(0x8c9aa6), paper(0xb8b2a2)]
  const tape = cloth(0x3a4130)
  const parts = []
  const count = covers.length
  for (let index = 0; index < count; index++) {
    const phi = -1.0 + (2.0 * index) / (count - 1)
    const radiusZ = 0.0657
    const radiusY = 0.05
    const y = 0.0295 + radiusY * Math.cos(phi) - radiusY * Math.cos(1.0)
    const z = radiusZ * Math.sin(phi)
    const angle = Math.atan2(radiusY * Math.sin(phi), radiusZ * Math.cos(phi))
    parts.push(mesh(bx(0.3, 0.008, 0.052), covers[index]!, [0, y, z], [angle, 0, 0]))
    for (const x of [-0.075, 0.075]) parts.push(mesh(bx(0.025, 0.008, 0.052), tape, [x, y + 0.006, z], [angle, 0, 0]))
  }
  return G(...parts)
}
