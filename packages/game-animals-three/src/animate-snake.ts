import type * as THREE_NS from 'three'

import type { AnimateParams } from './animate-types'
import type { AnimalRig, Three } from './types'

const { PI } = Math

/** The path of the body for a clip: crawling in a wave, or coiled with the head up in an S (and striking when `strike` rises). */
const bodyPath = (THREE: Three, rig: AnimalRig, params: AnimateParams, spacing: number): THREE_NS.Vector3[] => {
  const { time: t, clip } = params
  const points: THREE_NS.Vector3[] = []
  for (let index = 0; index < rig.segmentCount; index++) {
    let x: number
    let z: number
    let y = 0
    if (clip === 'walk') {
      z = 0.6 - index * spacing
      x = Math.sin(rig.phase * 2.2 - index * 0.42) * 0.08 * Math.min(1, index / 6 + 0.3)
    } else {
      const strike = clip === 'run' ? Math.max(0, Math.sin(t * 2.2)) ** 6 : 0
      if (index < 9) {
        const k = index / 9
        z = 0.08 + (1 - k) * 0.12 + strike * (1 - k) * 0.35
        y = (1 - k) * 0.13 * (1 - strike * 0.6)
        x = Math.sin(k * PI * 1.6) * 0.05 * (1 - strike)
      } else {
        const angle = (index - 9) * 0.36
        const radius = 0.16 - (index - 9) * 0.0045
        x = Math.cos(angle) * radius
        z = Math.sin(angle) * radius - 0.05
        y = (index - 9) * 0.0012
      }
    }
    points.push(new THREE.Vector3(x, y, z))
  }
  return points
}

/** Advances a snake (page: `animSnake`): lays the 34 segments along the path of the clip, then the head, jaw and tongue. */
export const animateSnake = (THREE: Three, rig: AnimalRig, params: AnimateParams): void => {
  const { time: t, delta: dt, clip } = params
  const spacing = rig.segmentLength * (params.split ? 1.5 : 1)
  if (clip === 'walk') rig.phase += dt * 2.4
  const points = bodyPath(THREE, rig, params, spacing)
  const at = (index: number): THREE_NS.Vector3 => points[index] as THREE_NS.Vector3
  for (let index = 0; index < rig.segmentCount; index++) {
    const group = (rig.segments[index] as AnimalRig['segments'][number]).group
    group.position.copy(at(index))
    const direction = index === 0 ? at(0).clone().sub(at(1)) : at(index - 1).clone().sub(at(index))
    group.rotation.set(0, Math.atan2(direction.x, direction.z), 0)
    group.rotateX(-Math.atan2(direction.y, Math.hypot(direction.x, direction.z)))
  }
  const head = rig.head as THREE_NS.Group
  const headDirection = at(0).clone().sub(at(1)).normalize()
  head.position.copy(at(0)).addScaledVector(headDirection, 0.02)
  head.rotation.set(0, Math.atan2(headDirection.x, headDirection.z), 0)
  head.rotateX(-Math.atan2(headDirection.y, Math.hypot(headDirection.x, headDirection.z)) * 0.5)
  const jaw = rig.jaw as THREE_NS.Group
  jaw.rotation.x = clip === 'run' ? Math.max(0, Math.sin(t * 2.2)) ** 6 * 0.9 : 0
  const tongue = rig.tongue as THREE_NS.Mesh
  tongue.visible = Math.sin(t * 5) > 0.3
  tongue.scale.z = 1 + Math.sin(t * 20) * 0.3
}
