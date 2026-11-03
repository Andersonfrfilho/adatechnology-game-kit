import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createVehicleCamera, mirrorPoses } from '../src'
import type { VehicleFrame, VehicleThreeLib } from '../src'

const lib = THREE as unknown as VehicleThreeLib
const car: VehicleFrame = { x: 10, y: 0, z: -5, yaw: 0, speed: 0, length: 4.2, width: 1.9, height: 1.47 }
const forward = (camera: THREE.PerspectiveCamera): THREE.Vector3 => new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

describe('vehicle cameras', () => {
  it('chase: behind the tail, over the roof, looking toward the front; pulls back and widens with speed', () => {
    const rig = createVehicleCamera(lib)
    const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 500)
    rig.update(camera as never, car, 1 / 60)
    expect(camera.position.z).toBeLessThan(car.z - car.length / 2 - 4)
    expect(camera.position.y).toBeGreaterThan(car.height + 1)
    expect(forward(camera).z).toBeGreaterThan(0.8)
    const still = camera.position.z
    rig.reset()
    rig.update(camera as never, { ...car, speed: 30 }, 1 / 60)
    expect(camera.position.z).toBeLessThan(still - 1)
    expect(camera.fov).toBeGreaterThan(70)
  })

  it('chase: trails a turn and settles behind the new heading', () => {
    const rig = createVehicleCamera(lib)
    const camera = new THREE.PerspectiveCamera()
    rig.update(camera as never, car, 1 / 60)
    const turned = { ...car, yaw: Math.PI / 2 }
    rig.update(camera as never, turned, 1 / 60)
    // a quarter turn: the front now points to +x; one frame later the camera has not swung all the way
    expect(camera.position.x).toBeGreaterThan(car.x - 8)
    for (let i = 0; i < 300; i++) rig.update(camera as never, turned, 1 / 60)
    expect(camera.position.x).toBeLessThan(car.x - car.length / 2 - 4)
    expect(Math.abs(camera.position.z - car.z)).toBeLessThan(0.05)
  })

  it('cockpit: at the driver eyes inside the car, looking ahead; hood: on the hood', () => {
    const rig = createVehicleCamera(lib)
    const camera = new THREE.PerspectiveCamera()
    rig.setMode('cockpit')
    rig.update(camera as never, car, 1 / 60)
    expect(camera.position.x).toBeGreaterThan(car.x)
    expect(camera.position.x).toBeLessThan(car.x + car.width / 2)
    expect(camera.position.y).toBeLessThan(car.height)
    expect(Math.abs(camera.position.z - car.z)).toBeLessThan(car.length / 2)
    expect(forward(camera).z).toBeGreaterThan(0.99)
    expect(rig.cycle()).toBe('hood')
    rig.update(camera as never, car, 1 / 60)
    expect(camera.position.z).toBeGreaterThan(car.z)
  })

  it('mirrors look backward from their place on the car, turned with it', () => {
    const camera = new THREE.PerspectiveCamera()
    const rig = createVehicleCamera(lib)
    const poses = mirrorPoses(car)
    expect(poses.map((p) => p.id)).toEqual(['rear_view', 'left', 'right', 'reverse'])
    for (const pose of poses) {
      rig.placeMirror(camera as never, pose, car)
      expect(forward(camera).z).toBeLessThan(-0.6)
    }
    const left = poses.find((p) => p.id === 'left')!
    rig.placeMirror(camera as never, left, { ...car, yaw: Math.PI })
    // turned around, the left mirror sits on the other side of the world
    expect(camera.position.x).toBeLessThan(car.x - car.width / 2)
    expect(forward(camera).z).toBeGreaterThan(0.6)
    const reverse = poses.find((p) => p.id === 'reverse')!
    rig.placeMirror(camera as never, reverse, car)
    expect(forward(camera).y).toBeLessThan(-0.3)
    expect(camera.fov).toBeGreaterThan(90)
  })
})
