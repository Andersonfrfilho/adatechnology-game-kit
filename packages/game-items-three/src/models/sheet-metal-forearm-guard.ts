import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const sheetMetalForearmGuard: ItemModelBuilder = ({ mesh, bx, G, metal, cloth }) => {
  const sheet = metal(0x7d8186)
  const strap = cloth(0x4a3a2a)
  const rivet = metal(0xb5b8bb)
  const parts = []
  const count = 7
  const radiusZ = 0.0555
  const radiusY = 0.092
  const phiMax = 1.3
  for (let index = 0; index < count; index++) {
    const phi = -phiMax + (2 * phiMax * index) / (count - 1)
    const y = 0.0455 + radiusY * (Math.cos(phi) - Math.cos(phiMax))
    const z = radiusZ * Math.sin(phi)
    const speed = Math.hypot(radiusY * Math.sin(phi), radiusZ * Math.cos(phi))
    const angle = Math.atan2(radiusY * Math.sin(phi), radiusZ * Math.cos(phi))
    const length = (speed * (2 * phiMax)) / (count - 1) * 1.1
    parts.push(mesh(bx(0.3, 0.006, length), sheet, [0, y, z], [angle, 0, 0]))
    for (const x of [-0.09, 0.09]) parts.push(mesh(bx(0.03, 0.006, length), strap, [x, y + 0.006, z], [angle, 0, 0]))
  }
  parts.push(mesh(bx(0.012, 0.012, 0.012), rivet, [0.09, 0.0985, 0]), mesh(bx(0.012, 0.012, 0.012), rivet, [-0.09, 0.0985, 0]))
  return G(...parts)
}
