import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createVehicleDestructible, createVehicleKit } from '@adatechnology/game-vehicles'
import type { VehicleContext } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'

import { createVehicleBody, createVehiclesThree } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createVehicleKit({ THREE: THREE as never, locale: 'en', document: fakeDocument as never })
installFleet(kit, { sunroofs: ['fastback_sedan'] })
const setUp = (id: string) => {
  const built = createVehiclesThree(THREE, { kit }).build(id, { quality: 'high' })
  const d = createVehicleDestructible(kit, built.context as VehicleContext, { id, frame: built.group })
  const body = createVehicleBody(built, { THREE, clips: d.animations() })
  const root = (built.context as unknown as { vehicle: THREE.Object3D }).vehicle
  return { built, d, body, root }
}
const worldY = (o: THREE.Object3D): number => {
  o.updateWorldMatrix(true, false)
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y
}
const run = (body: ReturnType<typeof createVehicleBody>, seconds: number, wipe = 0): void => {
  for (let t = 0; t < seconds; t += 1 / 30) body.update(1 / 30, wipe)
}

describe('vehicle body', () => {
  it('opens each door on its own hinge to the clip pose and shuts it; the hood and the lid too', () => {
    const { body, root } = setUp('fastback_sedan')
    expect(body.parts).toEqual(expect.arrayContaining(['door_front_left', 'door_front_right', 'hood']))
    body.toggle('door_front_left')
    run(body, 1.5)
    expect(body.openness('door_front_left')).toBe(1)
    expect(Math.abs(root.getObjectByName('door_front_left')!.rotation.y)).toBeCloseTo(1.15, 2)
    expect(root.getObjectByName('door_front_right')!.rotation.y).toBeCloseTo(0, 6)
    body.toggle('hood')
    run(body, 1.5)
    expect(body.openness('hood')).toBe(1)
    body.toggle('door_front_left')
    run(body, 1.5)
    expect(root.getObjectByName('door_front_left')!.rotation.y).toBeCloseTo(0, 6)
  })

  it('locked, the doors refuse to open and the hood still does', () => {
    const { body } = setUp('fastback_sedan')
    body.lock(true)
    expect(body.toggle('door_front_left')).toEqual([{ type: 'refused', part: 'door_front_left', reason: 'locked' }])
    expect(body.toggle('hood')[0]?.type).toBe('sound')
    body.lock(false)
    expect(body.toggle('door_front_left')[0]?.type).toBe('sound')
  })

  it('lowers each side window into its door on its own, and it goes down with the door opened', () => {
    const panes = setUp('fastback_sedan')
    expect(panes.body.windows).toEqual(expect.arrayContaining(['front_left', 'front_right', 'rear_left', 'rear_right']))
    const glass = (panes.built.context as unknown as { glass: THREE.Mesh[] }).glass.filter((g) => (g.userData.glass as { key?: string }).key === 'window_front')
    const left = glass.find((g) => (g.userData.glass as { side: number }).side < 0)!
    const right = glass.find((g) => (g.userData.glass as { side: number }).side > 0)!
    const [l0, r0] = [worldY(left), worldY(right)]
    panes.body.toggleWindow('front_left')
    run(panes.body, 4)
    expect(panes.body.window('front_left')).toBe(1)
    expect(worldY(left)).toBeLessThan(l0 - 0.25)
    expect(worldY(right)).toBeCloseTo(r0, 5)
    panes.body.toggle('door_front_left')
    run(panes.body, 1.5)
    panes.body.toggleWindow('front_left')
    run(panes.body, 4)
    expect(worldY(left)).toBeCloseTo(l0, 2)
  })

  it('slides the sunroof back where the model has one, and sweeps the wiper blades over the glass', () => {
    const { body, root, built } = setUp('fastback_sedan')
    expect(body.hasSunroof).toBe(true)
    const pane = root.getObjectByName('sunroof')!
    const x0 = pane.position.x
    body.toggleSunroof()
    run(body, 3)
    expect(pane.position.x).toBeLessThan(x0 - 0.4)
    expect(body.wipers).toBe(2)
    const blade = (built.context as unknown as { wipers: Array<{ part: THREE.Object3D; tag: { arm: number } }> }).wipers.find((w) => w.tag.arm === 0)!.part
    const rest = blade.position.clone()
    const restQ = blade.quaternion.clone()
    run(body, 0.7, 0.7)
    expect(blade.position.distanceTo(rest)).toBeGreaterThan(0.05)
    run(body, 3, 0)
    // parked, the blade is back on the exact numbers the builder drew
    expect(blade.position.equals(rest)).toBe(true)
    expect(blade.quaternion.equals(restQ)).toBe(true)
    expect(setUp('compact_hatch').body.hasSunroof).toBe(false)
  })

  it('puts every part back on dispose', () => {
    const { body, root } = setUp('fastback_sedan')
    body.toggle('door_front_left')
    body.toggleSunroof()
    run(body, 3, 1)
    body.dispose()
    expect(root.getObjectByName('door_front_left')!.rotation.y).toBeCloseTo(0, 6)
  })
})
