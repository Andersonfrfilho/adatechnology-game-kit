import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'

import { createVehiclesThree, createWheelRoll } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createVehicleKit({ THREE: THREE as never, locale: 'en', document: fakeDocument as never })
installFleet(kit)

describe('wheel roll', () => {
  it('turns every wheel about its axle by the distance over the radius, steers only the front ones, and puts them back on dispose', () => {
    const built = createVehiclesThree(THREE, { kit }).build('compact_hatch', { quality: 'high' })
    const wheels = (built.context as unknown as { wheels: THREE.Object3D[] }).wheels
    const rest = wheels.map((w) => w.quaternion.clone())
    const roll = createWheelRoll(THREE, built)
    expect(roll.count).toBe(4)
    const radius = Number(wheels[0]!.userData.r)
    // a quarter turn forward: the top of the wheel goes ahead (+x of the kit frame)
    roll.roll((Math.PI / 2) * radius, 0)
    const top = new THREE.Vector3(0, 1, 0).applyQuaternion(wheels[0]!.quaternion.clone().multiply(rest[0]!.clone().invert()))
    expect(top.x).toBeCloseTo(1, 5)
    roll.roll(0, 0.4)
    const front = wheels.filter((w) => w.position.x > 0)
    const rear = wheels.filter((w) => w.position.x <= 0)
    // the axle (z) turns with the steering: steered left, it leans toward the front
    const axle = (w: THREE.Object3D, i: number): number => new THREE.Vector3(0, 0, 1).applyQuaternion(w.quaternion.clone().multiply(rest[i]!.clone().invert())).x
    for (const w of front) expect(axle(w, wheels.indexOf(w))).toBeCloseTo(Math.sin(0.4), 5)
    for (const w of rear) expect(Math.abs(axle(w, wheels.indexOf(w)))).toBeLessThan(1e-9)
    roll.dispose()
    wheels.forEach((w, i) => expect(w.quaternion.equals(rest[i]!)).toBe(true))
  })
})
