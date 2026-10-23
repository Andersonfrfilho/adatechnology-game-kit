import { createWorld, type Motion, type ObjectSpec, type Vec3 } from '@adatechnology/game-interactables'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createMeshApi, poseOf, syncObject } from '../src'
import { poseOf as enginePoseOf } from '@adatechnology/game-interactables'

const motions: Record<string, Motion> = {
  hinge: { kind: 'hinge' },
  rocker: { kind: 'rocker' },
  knob: { kind: 'knob' },
  slide: { kind: 'slide', axis: [1, 0, 0] },
  slideDiagonal: { kind: 'slide', axis: [1, 0, 1] },
  tiltedHinge: { kind: 'hinge', axis: [1, 0, 0], angle: 1.1 },
  scale: { kind: 'scale', axis: [0, 1, 0] },
}

describe('poseOf matches the engine', () => {
  it.each(Object.entries(motions))('%s: same defaults, same axis handling', (_name, motion) => {
    for (const t of [0, 0.3, 1]) {
      const mine = poseOf(motion, t)
      const eng = enginePoseOf(motion, t)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...eng.rotation.axis).normalize(), eng.rotation.angle)
      expect(mine.quaternion[3]).toBeCloseTo(q.w, 9)
      expect(mine.quaternion[0]).toBeCloseTo(q.x, 9)
      expect(mine.quaternion[1]).toBeCloseTo(q.y, 9)
      expect(mine.quaternion[2]).toBeCloseTo(q.z, 9)
      mine.position.forEach((v, i) => expect(v).toBeCloseTo(eng.position[i], 9))
      mine.scale.forEach((v, i) => expect(v).toBeCloseTo(eng.scale[i], 9))
    }
  })
})

describe('rendered parts agree with the engine', () => {
  // A tiny box sits exactly on a container slot of each part; after syncObject the box must be where world.slotPosition says.
  it.each(Object.entries(motions).filter(([name]) => name !== 'scale'))('%s: mesh centre equals slotPosition', (name, motion) => {
    const pivot: Vec3 = [0.3, 0.2, 0.1]
    const ry = 0.45
    const at: Vec3 = [0.8, 0.55, -0.4]
    const spec: ObjectSpec = {
      type: 'x',
      parts: [{ id: 'p', pivot, ry, motion }],
      containers: [{ id: 'c', volume: { center: at, half: [0.1, 0.1, 0.1] }, slots: [{ pos: at, max: [0.1, 0.1, 0.1], part: 'p' }] }],
    }
    const transform = { x: 2, y: 0.5, z: -3, ry: 0.7 }
    const world = createWorld()
    world.add('o', spec, transform)
    world.setPart('o', 'p', 0.6, true)

    const { api, finish } = createMeshApi(THREE)
    api.part('p', pivot, ry, () => api.box({}, 'plain', at[0], at[1] - 0.005, at[2], 0.01, 0.01, 0.01, 0xffffff, 0, 0, 0))
    const { group, parts } = finish()
    group.position.set(transform.x, transform.y, transform.z)
    group.rotation.y = transform.ry
    syncObject(THREE, world, 'o', parts)
    group.updateMatrixWorld(true)

    const mesh = parts.p.children[0] as THREE.Mesh
    mesh.geometry.computeBoundingBox()
    const centre = mesh.localToWorld(mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()))
    const slot = world.slotPosition('o', 'c', 0)
    expect(centre.x, name).toBeCloseTo(slot[0], 5)
    expect(centre.y, name).toBeCloseTo(slot[1], 5)
    expect(centre.z, name).toBeCloseTo(slot[2], 5)
  })
})
