import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const cassavaCuttings: ItemModelBuilder = ({ mesh, cyl, G, wood }) => {
  const stick = wood(0x9b7b55)
  const group = G()
  const rows: ReadonlyArray<readonly [number, readonly number[]]> = [[0.02, [-0.04, 0, 0.04]], [0.06, [-0.02, 0.02]], [0.1, [-0.04, 0, 0.04]]]
  rows.forEach(([y, zs]) => zs.forEach((z) => group.add(mesh(cyl(0.02, 0.02, 0.7, 8), stick, [0, y, z], [0, 0, Math.PI / 2]))))
  return group
}
