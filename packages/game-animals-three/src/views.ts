import type * as THREE_NS from 'three'

import type { AnimalRig } from './types'

/** The "joints" view (page: `setJoint`): the coat turns see-through and every joint ball shows in `jointMaterial`. */
export const setJointView = (rig: AnimalRig, on: boolean, jointMaterial: THREE_NS.Material): void => {
  rig.materials.forEach((material) => {
    if (material === rig.eyeMaterial) return
    material.transparent = on
    material.opacity = on ? 0.28 : 1
    material.depthWrite = !on
    material.needsUpdate = true
  })
  rig.joints.forEach((joint) => {
    if (on) joint.userData.restMaterial ??= joint.material
    joint.material = on ? jointMaterial : (joint.userData.restMaterial as THREE_NS.Material)
    joint.renderOrder = on ? 2 : 0
  })
}

/** The "split" view (page: `setSplit`): sets where each pivot should go, the rest position or the rest plus its offset; `updateSplit` moves it there. */
export const setSplit = (rig: AnimalRig, on: boolean): void => {
  rig.pivots.forEach((pivot) => {
    pivot.group.userData.target = on ? pivot.rest.clone().add(pivot.offset) : pivot.rest.clone()
  })
}

/** Moves each pivot toward its split target (the page does it in the frame loop: a lerp of 5 per second). */
export const updateSplit = (rig: AnimalRig, delta: number): void => {
  rig.pivots.forEach((pivot) => {
    const target = pivot.group.userData.target as THREE_NS.Vector3 | undefined
    if (target) pivot.group.position.lerp(target, Math.min(1, delta * 5))
  })
}
