/**
 * The places on the player's body that take a weapon put away (`hip`: a holster on the weapon side of the belt; `back`: a sling across the back): sockets fixed to the body, read
 * from the body's own surface at rest, so a weapon drawn there sits on the trousers or the shirt and never in them. `sling`: the point on the front of the chest a long
 * gun hangs from on its sling (owner, 2026-11-25), a little to the weapon side. Each socket's frame is the body's: +z its front, -x the weapon side.
 */
import type * as THREE_NS from 'three'

import type { RichRig } from '../rich/animator'

export type BodySlotName = 'hip' | 'back' | 'sling'

/** How far off the surface (m) a socket sits, so what is drawn there never shares a plane with the cloth. */
export const BODY_SLOT_CLEARANCE = 0.006

/** The bands of the body (m above the feet of a 1.75 m body, scaled with it) the hip and the back are read in. */
const BELT_BAND = [0.8, 0.95] as const
const CHEST_BAND = [1.05, 1.3] as const
/** The hip holster hangs from the belt: the middle of the weapon this far under its top, and a touch behind the side seam. */
const HIP = { y: 0.8, z: -0.01 }
/** The middle of a long gun slung across the back, at the height of the shoulder blades. */
const BACK_Y = 1.12
/** Where the sling holds a long gun on the front of the chest: the height of the breastbone, this far to the weapon side. */
const SLING = { y: 1.2, x: 0.07 }

/** Corners of the body at rest (avatar space) in a band of height, the arms left out (they swing). */
const bandOf = (THREE: typeof THREE_NS, root: THREE_NS.Object3D, skip: readonly THREE_NS.Object3D[], band: readonly [number, number]): { maxX: number; minZ: number; maxZ: number } => {
  let maxX = 0
  let minZ = 0
  let maxZ = 0
  const point = new THREE.Vector3()
  const toBody = root.matrixWorld.clone().invert()
  const inArm = (node: THREE_NS.Object3D | null): boolean => (node ? skip.includes(node) || inArm(node.parent) : false)
  root.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    const position = mesh.isMesh ? mesh.geometry?.attributes.position : undefined
    if (!position || inArm(mesh)) return
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position as THREE_NS.BufferAttribute, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(toBody)
      if (point.y < band[0] || point.y > band[1]) continue
      maxX = Math.max(maxX, Math.abs(point.x))
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    }
  })
  return { maxX, minZ, maxZ }
}

/** Makes the sockets on a body (read in the space of its `root`, standing at rest); `scale` is the body's height against the reference one. */
export const createBodySlots = (THREE: typeof THREE_NS, rig: RichRig, root: THREE_NS.Object3D, scale: number): Record<BodySlotName, THREE_NS.Object3D> => {
  root.updateMatrixWorld(true)
  const arms = rig.arms.map((arm) => arm.g as unknown as THREE_NS.Object3D)
  const belt = bandOf(THREE, root, arms, [BELT_BAND[0] * scale, BELT_BAND[1] * scale])
  const chest = bandOf(THREE, root, arms, [CHEST_BAND[0] * scale, CHEST_BAND[1] * scale])
  const place = (name: BodySlotName, parent: THREE_NS.Object3D, at: THREE_NS.Vector3): THREE_NS.Object3D => {
    const socket = new THREE.Object3D()
    socket.name = `slot_${name}`
    parent.add(socket)
    socket.position.copy(parent.worldToLocal(root.localToWorld(at)))
    // the socket keeps the body's own turn, whatever the turn of the part it rides
    socket.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())))
    return socket
  }
  return {
    hip: place('hip', rig.fig as unknown as THREE_NS.Object3D, new THREE.Vector3(-(belt.maxX + BODY_SLOT_CLEARANCE), HIP.y * scale, HIP.z * scale)),
    back: place('back', rig.upper as unknown as THREE_NS.Object3D, new THREE.Vector3(0, BACK_Y * scale, chest.minZ - BODY_SLOT_CLEARANCE)),
    sling: place('sling', rig.upper as unknown as THREE_NS.Object3D, new THREE.Vector3(-SLING.x * scale, SLING.y * scale, chest.maxZ + BODY_SLOT_CLEARANCE)),
  }
}
