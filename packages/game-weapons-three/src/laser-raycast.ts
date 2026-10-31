import type * as THREE_NS from 'three'
import type { LaserRaycast } from './models/attachments/types'

/** Names of the groups that hold the weapon in the hands (and the `userData.viewmodel` flag of what holds it: the room marks the player's body): the beam of a laser never lands on its own weapon or its own holder. */
export const VIEWMODEL_NODE_NAME = 'weapon-viewmodel'
export const IN_HAND_NODE_NAME = 'weapon-in-hand'

/** The laser is measured this many times per second at most; between the casts the last distance holds. */
export const LASER_RAYCAST_HZ = 30

const isHeld = (object: THREE_NS.Object3D): boolean => {
  for (let node: THREE_NS.Object3D | null = object; node; node = node.parent) if (node.name === VIEWMODEL_NODE_NAME || node.name === IN_HAND_NODE_NAME || node.userData?.viewmodel === true) return true
  return false
}

/** A node counts only when it and every ancestor are visible: `Object3D.visible` of a parent hides the children but the raycaster does not look at it. */
export const isVisibleInScene = (object: THREE_NS.Object3D): boolean => {
  for (let node: THREE_NS.Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

export interface LaserRaycastOptions {
  /** Milliseconds clock (default `performance.now`). */
  readonly now?: () => number
}

/** The ray of a laser sight against what is in the scene, ignoring the weapon in the hands, what is hidden (itself or by an ancestor), what is see-through and what is not a surface (particles, sprites). */
export const createLaserRaycast = (THREE: typeof THREE_NS, scene: THREE_NS.Scene, camera: THREE_NS.Camera, options: LaserRaycastOptions = {}): LaserRaycast => {
  const now = options.now ?? ((): number => performance.now())
  const interval = 1000 / LASER_RAYCAST_HZ
  const raycaster = new THREE.Raycaster()
  // the smoke is made of sprites and translucent solids, and the sprites need the camera to be tested at all
  raycaster.camera = camera
  let lastAt = -Infinity
  let lastReach: number | null = null
  return (origin, direction, maxDistance) => {
    const at = now()
    if (at - lastAt < interval) return lastReach
    lastAt = at
    raycaster.set(origin, direction)
    raycaster.far = maxDistance
    const hit = raycaster.intersectObjects(scene.children, true).find((entry) => {
      const mesh = entry.object as THREE_NS.Mesh
      const material = mesh.material as THREE_NS.Material | undefined
      return mesh.isMesh && isVisibleInScene(mesh) && material?.transparent !== true && !isHeld(mesh)
    })
    lastReach = hit ? hit.distance : null
    return lastReach
  }
}
