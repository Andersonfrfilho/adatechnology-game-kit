import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createLightBudget } from '@adatechnology/game-render-three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'

import { createVehiclesThree, createVehicleLamps } from '../src'
import type { LampSwitch } from '../src'
import { fakeDocument } from './fake-dom'

const kit = createVehicleKit({ THREE: THREE as never, locale: 'en', document: fakeDocument as never })
installFleet(kit)
const build = (id: string) => createVehiclesThree(THREE, { kit }).build(id, { quality: 'high' })
const OFF: LampSwitch = { mode: 'off', fog: false, interior: false, brake: false, reverse: false, left: false, right: false }

const glowOf = (built: ReturnType<typeof build>, kind: string): number => {
  const lights = (built.context as unknown as { lights: Array<{ kind: string; inner: THREE.Mesh[] }> }).lights
  let sum = 0
  for (const l of lights) if (l.kind === kind) for (const m of l.inner) sum += (m.material as THREE.MeshStandardMaterial).emissiveIntensity ?? 0
  return sum
}

describe('vehicle lamps', () => {
  it('switches the glass of the head and tail lamps and takes the beams from the light budget, and puts everything back on dispose', () => {
    const built = build('compact_hatch')
    const scene = new THREE.Scene()
    scene.add(built.group)
    const budget = createLightBudget(THREE as never, scene, { spot: 4, point: 8 })
    const shared = new Set<THREE.Material>()
    built.group.traverse((o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m) shared.add(m)
    })
    const lamps = createVehicleLamps(THREE, built, { lights: budget })
    expect(lamps.has.head && lamps.has.tail).toBe(true)
    const off = glowOf(built, 'headlight')
    lamps.set({ ...OFF, mode: 'low' })
    const low = glowOf(built, 'headlight')
    expect(low).toBeGreaterThan(off * 5)
    expect(budget.stats().sources).toBe(2)
    lamps.set({ ...OFF, mode: 'high' })
    expect(glowOf(built, 'headlight')).toBeGreaterThan(low)
    expect(budget.stats().sources).toBe(2)
    const tail = glowOf(built, 'taillight')
    lamps.set({ ...OFF, mode: 'high', brake: true, reverse: true, interior: true })
    expect(glowOf(built, 'taillight')).toBeGreaterThan(tail)
    expect(budget.stats().sources).toBe(4)
    // the kit's materials are shared by every car: this one switched copies of its own
    let copies = 0
    built.group.traverse((o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m && !shared.has(m)) copies++
    })
    expect(copies).toBeGreaterThan(0)
    lamps.dispose()
    expect(budget.stats().sources).toBe(0)
    built.group.traverse((o: THREE.Object3D) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m) expect(shared.has(m)).toBe(true)
    })
    budget.dispose()
    built.dispose()
  })

  it('finds the fog lamps a body has (a SUV draws them as lamps) and none on a car without them', () => {
    const suv = build('midsize_suv')
    const lamps = createVehicleLamps(THREE, suv)
    expect(lamps.has.fog).toBe(true)
    lamps.dispose()
    suv.dispose()
    const bus = build('city_bus')
    const none = createVehicleLamps(THREE, bus)
    expect(none.has.fog).toBe(false)
    none.dispose()
    bus.dispose()
  })
})
