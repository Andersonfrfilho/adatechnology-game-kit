import { buildHand } from '../rich/accessories/hands'
import type { THREE_NS } from '../three'

type Three = typeof THREE_NS

/** The palm of the Retratos do Vale hand (the same one the player's body wears in third person): a flattened ball this far down the hand from the wrist. */
const PALM = { radius: 0.048, scale: [0.6, 1.05, 1] as const, down: 0.035 }
/** How far the fingers curl at a full grip (radians), the near and the far joint, as the body's hand (`avatar.ts`) closes them. */
const CURL = { closed: 1.25, near: 0.9, far: 1.1 }
const THUMB = { open: 0.32, closed: 0.25 }

export type HandMesh = {
  /** The hand with its origin at the middle of the palm: x to the knuckles, y the back of the hand, z the little-finger side (the thumb at -z). */
  root: THREE_NS.Group
  /** 0 open, 1 closed on a grip. */
  setGrip(grip: number): void
  /** Curls the index finger on its own (0 extended, 1 curled); `undefined` gives it back to the grip. */
  setIndex(curl: number | undefined): void
  dispose(): void
}

/**
 * The first-person hand: the Retratos do Vale hand (a rounded palm, four fingers of two joints and a thumb, `buildHand`), the one the player's body wears in third person, turned
 * to the hand frame of `HandPose`. A left hand is made by mirroring the group (`scale.z = -1`).
 */
export const createHandMesh = (THREE: Three, skin: THREE_NS.Material, wristSkin: THREE_NS.Material = skin): HandMesh => {
  const root = new THREE.Group()
  root.name = 'first-person-hand'
  const geometries: THREE_NS.BufferGeometry[] = []
  const add = (parent: THREE_NS.Object3D, geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material, x = 0, y = 0, z = 0): THREE_NS.Mesh => {
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }
  // the team's hand hangs its fingers down -y with the palm toward +x (a right hand) and the thumb in front (+z): as the hand frame, its -y is x, its -x is y and its -z is z
  const group = new THREE.Group()
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1)))
  group.position.set(-PALM.down, 0, 0)
  root.add(group)
  add(group, new THREE.SphereGeometry(PALM.radius, 14, 10), skin, 0, -PALM.down, 0).scale.set(...PALM.scale)
  const built = buildHand({ THREE, add, hg: group, handM: skin, s: -1, detailed: true }) as { fingers: THREE_NS.Object3D[]; th: THREE_NS.Object3D | null }
  // the wrist the hand grows from, where the sleeve ends
  const wristGeometry = new THREE.CylinderGeometry(0.03, 0.033, 0.05, 10)
  wristGeometry.rotateZ(Math.PI / 2)
  add(root, wristGeometry, wristSkin, -PALM.down - 0.03, 0, 0)

  let lastGrip = 0
  let indexCurl: number | undefined
  const curlFinger = (finger: number, k: number): void => {
    built.fingers[finger * 2]!.rotation.z = k * CURL.closed * CURL.near
    built.fingers[finger * 2 + 1]!.rotation.z = k * CURL.closed * CURL.far
  }
  const applyIndex = (): void => curlFinger(0, indexCurl === undefined ? lastGrip : Math.min(1, Math.max(0, indexCurl)))
  const setGrip = (grip: number): void => {
    lastGrip = Math.min(1, Math.max(0, grip))
    for (let finger = 1; finger < 4; finger++) curlFinger(finger, lastGrip)
    if (built.th) built.th.rotation.z = THUMB.open + lastGrip * THUMB.closed
    applyIndex()
  }
  const setIndex = (value: number | undefined): void => {
    indexCurl = value
    applyIndex()
  }
  setGrip(0)
  return {
    root,
    setGrip,
    setIndex,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
    },
  }
}
