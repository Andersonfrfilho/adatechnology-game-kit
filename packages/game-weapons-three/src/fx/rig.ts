import type * as THREE_NS from 'three'
import type { AnimationPose, ToolRig } from '@adatechnology/game-contracts'
import { partRegistry } from '../models/part-registry'
import type { WeaponModel } from '../models'

/** The rig of a model: clip poses are offsets from the rest the parts had when the rig was made, as the contract says. */
export function createModelRig(model: WeaponModel): ToolRig {
  const registry = partRegistry(model.parts)
  const rest = new Map<THREE_NS.Object3D, { position: THREE_NS.Vector3; rotation: THREE_NS.Euler }>()
  for (const part of [...registry.values(), model.root]) rest.set(part, { position: part.position.clone(), rotation: part.rotation.clone() })
  const apply = (object: THREE_NS.Object3D, pose: AnimationPose): void => {
    const base = rest.get(object)
    if (!base) return
    const [dx, dy, dz] = pose.position ?? [0, 0, 0]
    const [rx, ry, rz] = pose.rotation ?? [0, 0, 0]
    object.position.set(base.position.x + dx, base.position.y + dy, base.position.z + dz)
    object.rotation.set(base.rotation.x + rx, base.rotation.y + ry, base.rotation.z + rz)
  }
  return {
    setPartPose(partId, pose) {
      const part = registry.get(partId)
      if (part) apply(part, pose)
    },
    setRootPose: (pose) => apply(model.root, pose),
  }
}
