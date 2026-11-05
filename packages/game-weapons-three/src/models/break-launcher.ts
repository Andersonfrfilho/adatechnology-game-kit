import type * as THREE_NS from 'three'

import type { ModelKit } from './kit'
import { buildRifle } from './rifle'
import type { BuiltModel, ModelOptions } from './types'

/**
 * The gallery's M79 (`buildExp('m79')`: the `rifle` builder with a wooden stock and forend and the 40 mm tube) with its break action: the tube and the forend ahead of the
 * receiver hang from a hinge (`barrels`) that folds down to load one grenade at the breech, as the real one opens. The meshes are the page's, moved under the hinge as they stand.
 */
export function buildBreakLauncher(kit: ModelKit, options: ModelOptions): BuiltModel {
  const built = buildRifle(kit, options)
  const { group, parts } = built
  const frames = parts.frames
  if (!frames) return built
  const hingeY = frames.barrelY - frames.barrelRadius
  const barrels = kit.pivot(group, frames.receiverEnd, hingeY, 0)
  group.updateMatrixWorld(true)
  const centre = new kit.THREE.Vector3()
  for (const child of [...group.children]) {
    if (child === barrels) continue
    const mesh = child as THREE_NS.Mesh
    const isAhead = mesh.isMesh ? new kit.THREE.Box3().setFromObject(mesh).getCenter(centre).x > frames.receiverEnd : child === parts.muzzle
    if (isAhead) barrels.attach(child)
  }
  parts.barrels = barrels
  parts.breech = [kit.mark(barrels, 0.004, frames.barrelY - hingeY, 0)]
  parts.eject = parts.breech[0]
  parts.family = 'break'
  return built
}
