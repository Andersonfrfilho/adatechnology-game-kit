import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'

import { createVehiclesThree, createVehicleDashboard } from '../src'
import type { DashboardReading } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createVehicleKit({ THREE: THREE as never, locale: 'en', document: fakeDocument as never })
installFleet(kit)
const build = (id: string) => createVehiclesThree(THREE, { kit }).build(id, { quality: 'high' })
const materials = (kit as unknown as { materials: Record<string, unknown> }).materials
const gauge = materials.gauge
const READING: DashboardReading = { kmh: 0, rpm: 0, gear: 1, ignition: false, engineOn: false, left: false, right: false, highBeam: false, lowBeam: false, fog: false, parkingBrake: true, seatbelt: false, fourWheel: false }

describe('vehicle dashboard', () => {
  it('lays a live face over each dial the kit drew, facing the driver along the dial, and takes everything away on dispose', () => {
    const built = build('compact_hatch')
    const before = built.group.children.length
    const needles = (): number => {
      let n = 0
      built.group.traverse((o: THREE.Object3D) => void ((o as THREE.Mesh).material === materials.amber && o.visible && n++))
      return n
    }
    const shown = needles()
    const dash = createVehicleDashboard(THREE, built, { gauge, needle: materials.amber, document: fakeDocument as never })
    expect(dash.dials).toBe(2)
    // the kit's two fixed needles step aside (and only those: the indicators stay)
    expect(needles()).toBe(shown - 2)
    const faces: THREE.Mesh[] = []
    built.group.traverse((o: THREE.Object3D) => void (o.name === 'dashboard_face' && faces.push(o as THREE.Mesh)))
    expect(faces).toHaveLength(2)
    // each face sits in front of the cabin's dash, between the dial and the driver's eyes, and looks at the eyes
    const eye = new THREE.Vector3(...built.driverEye!)
    for (const f of faces) {
      const toEye = eye.clone().sub(f.position).normalize()
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(f.quaternion)
      expect(facing.dot(toEye)).toBeGreaterThan(0.8)
      expect(f.position.distanceTo(eye)).toBeLessThan(1.2)
    }
    // a reading redraws the faces (the texture asks to be uploaded again); the same reading does not
    const tex = (faces[0]!.material as THREE.MeshBasicMaterial).map!
    const v0 = tex.version
    dash.update({ ...READING, kmh: 60, rpm: 2500, ignition: true, engineOn: true }, 1)
    expect(tex.version).toBeGreaterThan(v0)
    const v1 = tex.version
    dash.update({ ...READING, kmh: 60, rpm: 2500, ignition: true, engineOn: true }, 1)
    expect(tex.version).toBe(v1)
    dash.dispose()
    expect(built.group.children.length).toBe(before)
    expect(needles()).toBe(shown)
    built.dispose()
  })

  it('shows nothing on a vehicle without a cluster drawn', () => {
    const built = createVehiclesThree(THREE, { kit }).build('compact_hatch', { quality: 'lite' })
    const dash = createVehicleDashboard(THREE, built, { gauge, document: fakeDocument as never })
    expect(dash.dials).toBe(0)
    dash.update(READING, 1)
    dash.dispose()
    built.dispose()
  })
})
