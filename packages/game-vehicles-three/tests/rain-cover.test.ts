// @vitest-environment happy-dom
import { createVehicleKit, buildVehicleItem, createVehicleDestructible, createVehicleRainCover } from '@adatechnology/game-vehicles'
import { fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { VEHICLES_AREA_ID } from '../src'
import { fakeDocument } from './fake-dom'
import { breathe, roomWithVehicles } from './vehicles-room'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))
vi.setConfig({ testTimeout: 600_000 })

const kit = createVehicleKit({ THREE, document: fakeDocument })
installFleet(kit)

/** The covered share of a grid laid over the bounds of the vehicle's cover, and the highest cover found. */
function sweep(id: string): { kind: string; share: number; top: number | undefined; length: number; coveredLength: number } {
  const item = buildVehicleItem(kit, id)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${id}_1`, frame: item.root })
  const rain = createVehicleRainCover(d, { frame: item.root })
  rain.place()
  const [x0, z0, x1, z1] = rain.source.bounds()
  let covered = 0
  let top: number | undefined
  const steps = 20
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const value = rain.source.coverTopAt(x0 + ((i + 0.5) / steps) * (x1 - x0), z0 + ((j + 0.5) / steps) * (z1 - z0))
      if (value === undefined) continue
      covered++
      top = Math.max(top ?? -Infinity, value)
    }
  }
  const kind = String((item.vehicle.meta as { kind?: string }).kind)
  const { front, rear } = item.vehicle.meta as { front?: number; rear?: number }
  const length = (front ?? 0) - (rear ?? 0)
  kit.dispose(item.vehicle)
  return { kind, share: covered / (steps * steps), top, length, coveredLength: Math.max(x1 - x0, z1 - z0) }
}

const ROOFED = new Set(['car', 'bus', 'truck'])

describe('the rain cover of the whole fleet', () => {
  it('every road vehicle roofs its cabin or body, and bikes, boats, planes, helicopters and the tractor keep the sky', () => {
    const report: Record<string, ReturnType<typeof sweep>> = {}
    for (const id of fleetVehicleIds) report[id] = sweep(id)
    expect(Object.keys(report).length).toBeGreaterThan(50)
    for (const [id, found] of Object.entries(report)) {
      if (ROOFED.has(found.kind)) {
        expect(found.share, `${id} roofed`).toBeGreaterThan(0.9)
        expect(found.top!, `${id} roof height`).toBeGreaterThan(1.2)
      } else {
        expect(found.share, `${id} (${found.kind}) open`).toBe(0)
      }
    }
  })

  it('an open bed stays uncovered: the roof of a pickup is its cab, not its length', () => {
    const found = sweep('midsize_pickup')
    expect(found.coveredLength).toBeLessThan(found.length * 0.6)
  })
})

describe('the rain cover of the room', () => {
  it('a car laid in the vehicles area roofs the rain of the room', async () => {
    const { room, module } = roomWithVehicles('en', 'sedan')
    await breathe()
    room.openArea(VEHICLES_AREA_ID)
    for (let i = 0; i < 5; i++) room.update(1 / 60)
    expect(room.rainCover.isEmpty()).toBe(false)
    const root = ([...module.placed.values()][0] as { root: THREE.Object3D }).root
    const centre = root.localToWorld(new THREE.Vector3(0, 1, 0))
    const at = [centre.x, centre.y, centre.z]
    expect(room.rainCover.coverTopAt(at[0]!, at[2]!)).toBeGreaterThan(1)
    expect(room.rainCover.coverTopAt(at[0]! + 40, at[2]!)).toBeUndefined()
  })
})
