import type { THREE_NS } from '../three'

type Three = typeof THREE_NS

/** Lengths of the two segments and the width of each finger, from the thumb side to the little finger (a right hand: the thumb is at -z). Metres. */
const FINGERS = [
  { z: -0.03, near: 0.04, far: 0.03, width: 0.018 },
  { z: -0.01, near: 0.044, far: 0.034, width: 0.019 },
  { z: 0.01, near: 0.04, far: 0.03, width: 0.018 },
  { z: 0.028, near: 0.034, far: 0.026, width: 0.016 },
] as const
const PALM = { length: 0.09, thick: 0.024, width: 0.088 }
const FINGER_THICK = 0.017
/** The curl at a full grip, radians: the near segment, the far one, and the difference between the fingers (the little finger curls more). */
const CURL = { near: 1.32, far: 1.45, spread: 0.06 }
const THUMB = { base: [0.005, -0.006, -0.044] as const, near: 0.036, far: 0.03, width: 0.021 }

export type HandMesh = {
  /** The hand with its origin at the middle of the palm: x to the knuckles, y the back of the hand, z the little-finger side (the thumb at -z). */
  root: THREE_NS.Group
  /** 0 open, 1 closed on a grip. */
  setGrip(grip: number): void
  dispose(): void
}

/** A low-poly hand in the kit's style: a palm, four fingers of two segments that curl, and a thumb that folds over them. A left hand is made by mirroring the group (`scale.z = -1`). */
export const createHandMesh = (THREE: Three, skin: THREE_NS.Material, wristSkin: THREE_NS.Material = skin): HandMesh => {
  const root = new THREE.Group()
  root.name = 'first-person-hand'
  const geometries: THREE_NS.BufferGeometry[] = []
  const box = (parent: THREE_NS.Object3D, sx: number, sy: number, sz: number, x: number, y: number, z: number, material = skin): THREE_NS.Mesh => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz)
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }
  box(root, PALM.length, PALM.thick, PALM.width, 0, 0, 0)
  // the wrist the hand grows from
  const wristGeometry = new THREE.CylinderGeometry(0.03, 0.033, 0.05, 8)
  wristGeometry.rotateZ(Math.PI / 2)
  geometries.push(wristGeometry)
  const wrist = new THREE.Mesh(wristGeometry, wristSkin)
  wrist.position.set(-PALM.length / 2 - 0.018, 0, 0)
  wrist.frustumCulled = false
  root.add(wrist)

  const joints: Array<{ near: THREE_NS.Group; far: THREE_NS.Group; weight: number }> = []
  FINGERS.forEach((finger, index) => {
    const near = new THREE.Group()
    near.position.set(PALM.length / 2, 0.002, finger.z)
    box(near, finger.near, FINGER_THICK, finger.width, finger.near / 2, 0, 0)
    const far = new THREE.Group()
    far.position.set(finger.near, 0, 0)
    box(far, finger.far, FINGER_THICK * 0.92, finger.width * 0.94, finger.far / 2, 0, 0)
    near.add(far)
    root.add(near)
    joints.push({ near, far, weight: 1 + index * (CURL.spread / CURL.near) })
  })

  // the thumb: it points forward and out when open, and folds across the fingers, toward the palm, when closed
  const thumbNear = new THREE.Group()
  thumbNear.rotation.order = 'YZX'
  thumbNear.position.set(...THUMB.base)
  box(thumbNear, THUMB.near, FINGER_THICK * 1.1, THUMB.width, THUMB.near / 2, 0, 0)
  const thumbFar = new THREE.Group()
  thumbFar.position.set(THUMB.near, 0, 0)
  box(thumbFar, THUMB.far, FINGER_THICK, THUMB.width * 0.9, THUMB.far / 2, 0, 0)
  thumbNear.add(thumbFar)
  root.add(thumbNear)

  const setGrip = (grip: number): void => {
    const k = Math.min(1, Math.max(0, grip))
    for (const joint of joints) {
      joint.near.rotation.z = -CURL.near * k * joint.weight
      joint.far.rotation.z = -CURL.far * k * joint.weight
    }
    thumbNear.rotation.set(0, 0.55 - 1.45 * k, -0.1 - 0.75 * k)
    thumbFar.rotation.z = -0.1 - 0.7 * k
  }
  setGrip(0)
  return {
    root,
    setGrip,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
    },
  }
}
