import type { THREE_NS } from '../three'

type Three = typeof THREE_NS

/** Lengths of the three segments and the width of each finger, from the thumb side to the little finger (a right hand: the thumb is at -z). Metres; a finger is about 8 cm long. */
const FINGERS = [
  { z: -0.03, lengths: [0.034, 0.024, 0.02], width: 0.016 },
  { z: -0.0105, lengths: [0.038, 0.027, 0.022], width: 0.0165 },
  { z: 0.009, lengths: [0.035, 0.025, 0.02], width: 0.0155 },
  { z: 0.027, lengths: [0.029, 0.02, 0.018], width: 0.0135 },
] as const
const PALM = { length: 0.09, thick: 0.026, width: 0.09, wristWidth: 0.066 }
const FINGER_THICK = 0.0135
/** The curl at a full grip, radians: the three segments, and the difference between the fingers (the little finger curls more). */
const CURL = { near: 1.05, mid: 1.25, far: 0.85, spread: 0.06 }
const THUMB = { base: [0.005, -0.006, -0.044] as const, near: 0.034, far: 0.028, width: 0.019 }

export type HandMesh = {
  /** The hand with its origin at the middle of the palm: x to the knuckles, y the back of the hand, z the little-finger side (the thumb at -z). */
  root: THREE_NS.Group
  /** 0 open, 1 closed on a grip. */
  setGrip(grip: number): void
  dispose(): void
}

/** A low-poly hand in the kit's style: a palm, four fingers of three segments that curl, and a thumb that folds over them. A left hand is made by mirroring the group (`scale.z = -1`). */
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
  // the palm narrows toward the wrist: a box whose wrist end is pulled in
  const palmGeometry = new THREE.BoxGeometry(PALM.length, PALM.thick, PALM.width)
  const palmPosition = palmGeometry.getAttribute('position')
  for (let i = 0; i < palmPosition.count; i++) {
    if (palmPosition.getX(i) < 0) palmPosition.setZ(i, (palmPosition.getZ(i) * PALM.wristWidth) / PALM.width)
  }
  palmGeometry.computeVertexNormals()
  geometries.push(palmGeometry)
  const palm = new THREE.Mesh(palmGeometry, skin)
  palm.frustumCulled = false
  root.add(palm)
  // the wrist the hand grows from
  const wristGeometry = new THREE.CylinderGeometry(0.03, 0.033, 0.05, 8)
  wristGeometry.rotateZ(Math.PI / 2)
  geometries.push(wristGeometry)
  const wrist = new THREE.Mesh(wristGeometry, wristSkin)
  wrist.position.set(-PALM.length / 2 - 0.018, 0, 0)
  wrist.frustumCulled = false
  root.add(wrist)

  const joints: Array<{ segments: THREE_NS.Group[]; weight: number }> = []
  FINGERS.forEach((finger, index) => {
    const segments: THREE_NS.Group[] = []
    let parent: THREE_NS.Object3D = root
    let at = PALM.length / 2
    finger.lengths.forEach((length, k) => {
      const group = new THREE.Group()
      group.position.set(at, k === 0 ? 0.002 : 0, k === 0 ? finger.z : 0)
      const taper = 1 - k * 0.07
      box(group, length, FINGER_THICK * taper, finger.width * taper, length / 2, 0, 0)
      parent.add(group)
      segments.push(group)
      parent = group
      at = length
    })
    joints.push({ segments, weight: 1 + index * (CURL.spread / CURL.near) })
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
    const curl = [CURL.near, CURL.mid, CURL.far]
    for (const joint of joints) joint.segments.forEach((segment, i) => (segment.rotation.z = -curl[i]! * k * joint.weight))
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
