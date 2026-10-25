import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const fishingNet: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const cord = cloth(0x6f7a5a)
  const group = G()
  ;[0.003, 0.147].forEach((y) => {
    ;[-0.147, -0.05, 0.05, 0.147].forEach((z) => group.add(mesh(bx(0.35, 0.006, 0.006), cord, [0, y, z])))
    ;[-0.172, -0.086, 0, 0.086, 0.172].forEach((x) => group.add(mesh(bx(0.006, 0.006, 0.3), cord, [x, y, 0])))
  })
  ;[-0.172, 0.172].forEach((x) => [-0.147, 0.147].forEach((z) => group.add(mesh(bx(0.006, 0.15, 0.006), cord, [x, 0.075, z]))))
  return group
}
