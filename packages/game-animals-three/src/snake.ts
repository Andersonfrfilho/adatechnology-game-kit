import { addMesh, createRigTools } from './context'
import type { AnimalRig, Three } from './types'

const SEGMENT_COUNT = 34
const SEGMENT_LENGTH = 0.042

/** Builds a snake: 34 spheres on their own groups along the trunk (the animation lays them on a path), a head with a jaw and a tongue. */
export const buildSnake = (THREE: Three, rig: AnimalRig): AnimalRig => {
  const tools = createRigTools(THREE, rig)
  rig.size = 0.5
  rig.segmentLength = SEGMENT_LENGTH
  rig.segmentCount = SEGMENT_COUNT
  const primary = tools.material(0x7a6a4a)
  const secondary = tools.material(0x3a2e22)
  const belly = tools.material(0xb8a888)
  rig.main = primary
  for (let index = 0; index < SEGMENT_COUNT; index++) {
    const t = index / (SEGMENT_COUNT - 1)
    const radius = 0.012 + 0.03 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (t < 0.1 ? 0.75 + t * 2.5 : 1) + (t < 0.05 ? 0.012 : 0)
    const material = index % 4 === 1 || index % 4 === 2 ? secondary : primary
    const group = new THREE.Group()
    rig.trunk.add(group)
    const sphere = tools.ball(group, radius, material, 0, radius, 0, 1, 0.78, 1.5)
    sphere.userData.joint = index % 3 === 0 ? 1 : 0
    if (index % 3 === 0) rig.joints.push(sphere)
    rig.segments.push({ group, radius })
  }
  const head = new THREE.Group()
  rig.trunk.add(head)
  rig.head = head
  tools.ball(head, 0.032, primary, 0, 0.03, 0.025, 1.25, 0.6, 1.45)
  tools.ball(head, 0.024, secondary, 0, 0.04, 0.0, 1.3, 0.4, 0.9)
  tools.ball(head, 0.02, primary, 0, 0.028, 0.06, 0.85, 0.55, 1.1)
  const jaw = new THREE.Group()
  jaw.position.set(0, 0.018, 0.0)
  head.add(jaw)
  rig.jaw = jaw
  tools.ball(jaw, 0.026, belly, 0, 0, 0.035, 1.1, 0.35, 1.5)
  tools.eyes(head, 0.006, 0.03, 0.04, 0.045)
  rig.tongue = addMesh(THREE, head, new THREE.BoxGeometry(0.004, 0.002, 0.05), tools.material(0xb02020), 0, 0.024, 0.1)
  return rig
}
