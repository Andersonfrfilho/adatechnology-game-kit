import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { SUPPORT_BAND_M, supportSpanOf } from '../src/destructible/support-span'
import type { Matrix4, Object3D } from '../src/three-types'

const boxAt = (size: [number, number, number], at: [number, number, number]): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  mesh.position.set(...at)
  return mesh
}

const spanOf = (vehicle: THREE.Object3D): ReturnType<typeof supportSpanOf> => {
  vehicle.updateMatrixWorld(true)
  return supportSpanOf(vehicle as unknown as Object3D, vehicle.matrixWorld.clone().invert() as unknown as Matrix4)
}

describe('supportSpanOf: what a vehicle stands on, from its drawing', () => {
  it('a helicopter stands on its skids, not along its tail boom', () => {
    const helicopter = new THREE.Group()
    helicopter.add(boxAt([2, 0.08, 0.08], [0.05, 0.04, 0.95]), boxAt([2, 0.08, 0.08], [0.05, 0.04, -0.95]))
    helicopter.add(boxAt([2.4, 1.4, 1.2], [0.4, 1.2, 0]), boxAt([4, 0.3, 0.3], [-2.9, 1.3, 0]))
    expect(spanOf(helicopter)).toEqual({ rear: expect.closeTo(-0.95, 6), front: expect.closeTo(1.05, 6) })
  })

  it('a plane stands on its nose wheel and its main gear', () => {
    const plane = new THREE.Group()
    plane.add(boxAt([0.4, 0.4, 0.15], [1.7, 0.2, 0]), boxAt([0.44, 0.44, 0.15], [0, 0.22, 1.27]), boxAt([0.44, 0.44, 0.15], [0, 0.22, -1.27]))
    plane.add(boxAt([7, 1.2, 1.2], [-1, 1.4, 0]), boxAt([1.6, 0.1, 11], [0, 1.9, 0]))
    expect(spanOf(plane)).toEqual({ rear: expect.closeTo(-0.22, 6), front: expect.closeTo(1.9, 6) })
  })

  it('leaves out what starts above the band over the lowest point, and the decals', () => {
    const car = new THREE.Group()
    car.add(boxAt([0.6, 0.6, 0.2], [1.2, 0.3, 0.8]), boxAt([0.6, 0.6, 0.2], [-1.3, 0.3, 0.8]))
    car.add(boxAt([0.3, 0.3, 0.3], [-2.2, SUPPORT_BAND_M + 0.15 + 0.01, 0]))
    const decal = boxAt([6, 0.01, 0.01], [0, 0.005, 0])
    decal.userData.decal = true
    car.add(decal)
    expect(spanOf(car)).toEqual({ rear: expect.closeTo(-1.6, 6), front: expect.closeTo(1.5, 6) })
  })

  it('answers nothing for a vehicle with nothing drawn', () => {
    expect(spanOf(new THREE.Group())).toBeUndefined()
  })
})
