import { describe, expect, it } from 'vitest'
import type { Enclosure, Hit } from '@adatechnology/game-contracts'
import { buildVehicleItem, cabinBoxOf, cabinEnclosure, createVehicleDestructible, swingOf, type VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

function make(key = 'proto') {
  const kit = makeKit({ locale: 'en' })
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  return { kit, item, d }
}

const bullet = (d: VehicleDestructible, part: string, from: [number, number, number], energy = 500, caliber = 9): Hit => {
  const target = d.partWorldCenter(part)
  const dir: [number, number, number] = [target[0] - from[0], target[1] - from[1], target[2] - from[2]]
  const n = Math.hypot(...dir)
  const unit = dir.map((v) => v / n) as [number, number, number]
  const spec = d.describe().parts.find((p) => p.id === part)!
  const half = spec.shape.kind === 'box' ? spec.shape.size : [0, 0, 0]
  const point: [number, number, number] = [target[0] - unit[0] * half[0] * 0.5, target[1] - unit[1] * half[1] * 0.5, target[2] - unit[2] * half[2] * 0.5]
  return { type: 'ballistic', point, direction: unit, energy, caliber }
}

/** A world point in the enclosure's own frame (its centre, its axes). */
function local(e: Enclosure, p: readonly [number, number, number]): [number, number, number] {
  const [x, y, z, w] = e.orientation ?? [0, 0, 0, 1]
  const d = [p[0] - e.center[0], p[1] - e.center[1], p[2] - e.center[2]]
  // rotate by the conjugate quaternion
  const qx = -x
  const qy = -y
  const qz = -z
  const tx = 2 * (qy * d[2]! - qz * d[1]!)
  const ty = 2 * (qz * d[0]! - qx * d[2]!)
  const tz = 2 * (qx * d[1]! - qy * d[0]!)
  return [d[0]! + w * tx + (qy * tz - qz * ty), d[1]! + w * ty + (qz * tx - qx * tz), d[2]! + w * tz + (qx * ty - qy * tx)]
}

const within = (o: { center: readonly number[]; halfSize: readonly number[] }, p: readonly number[]): boolean =>
  [0, 1, 2].every((a) => Math.abs(p[a]! - o.center[a]!) <= o.halfSize[a]!)

describe('cabinEnclosure: the cabin of a car holds the smoke out', () => {
  it('a shut car is a closed box round its cabin, with only the gaps of the doors', () => {
    const { item, d } = make()
    const cabin = cabinBoxOf(d.vehicle)!
    expect(cabin).toBeTruthy()
    const e = cabinEnclosure(d, { frame: item.root })!
    expect(e).toBeTruthy()
    expect(e.openings).toEqual([])
    expect(e.leak).toBeGreaterThan(0)
    expect(e.leak).toBeLessThan(0.05)
    // the box is the cabin: about the inner width of the car and the height from the floor to the roof
    expect(e.halfSize[2] * 2).toBeCloseTo(cabin.z * 2, 5)
    expect(e.halfSize[1] * 2).toBeCloseTo(cabin.y1 - cabin.y0, 5)
  })

  it('follows the car where it is placed and turned', () => {
    const { item, d } = make()
    const before = cabinEnclosure(d, { frame: item.root })!
    item.root.position.set(5, 0, -3)
    item.root.rotation.set(0, Math.PI / 2, 0)
    item.root.updateMatrixWorld(true)
    const after = cabinEnclosure(d, { frame: item.root })!
    expect(after.center[0]).not.toBeCloseTo(before.center[0], 1)
    expect(Math.hypot(after.center[0] - 5, after.center[2] + 3)).toBeLessThan(1.5)
    const a = before.orientation!
    const b = after.orientation!
    // turned 90° about y from where it was: the two quaternions are 45° apart
    expect(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])).toBeCloseTo(Math.SQRT1_2, 3)
  })

  it('a door standing open opens that side of the cabin; shut again, it closes', () => {
    const { item, d } = make()
    const door = d.model.parts.find((p) => p.role === 'door')!
    const pivot = item.root.getObjectByName(door.id)!
    pivot.rotation.set(0, 0.9, 0)
    expect(swingOf(d.vehicle, door.id)).toBeGreaterThan(0.5)
    const open = cabinEnclosure(d, { frame: item.root })!
    expect(open.openings!.length).toBe(1)
    const opening = open.openings![0]!
    expect(opening.rate).toBeUndefined()
    // on the door's side of the cabin, through its wall
    const side = Math.sign(door.box.center[2])
    expect(Math.sign(opening.center[2])).toBe(side)
    expect(Math.abs(opening.center[2]) + opening.halfSize[2]).toBeGreaterThan(open.halfSize[2])
    expect(Math.abs(opening.center[2]) - opening.halfSize[2]).toBeLessThan(open.halfSize[2])
    pivot.rotation.set(0, 0, 0)
    expect(cabinEnclosure(d, { frame: item.root })!.openings).toEqual([])
  })

  it('a door only ajar a hair still counts as shut', () => {
    const { item, d } = make()
    const door = d.model.parts.find((p) => p.role === 'door')!
    item.root.getObjectByName(door.id)!.rotation.set(0, 0.03, 0)
    expect(cabinEnclosure(d, { frame: item.root })!.openings).toEqual([])
  })

  it('a shattered side window is an open hole in the cabin where the window was', () => {
    const { item, d } = make()
    d.hit(bullet(d, 'window_front_left', [-4, 1.2, 0]))
    expect(d.state().parts.find((p) => p.id === 'window_front_left')!.status).toBe('broken')
    const e = cabinEnclosure(d, { frame: item.root })!
    const open = e.openings!.filter((o) => o.rate === undefined)
    expect(open.length).toBe(1)
    expect(within(open[0]!, local(e, d.partWorldCenter('window_front_left')))).toBe(true)
  })

  it('a bullet hole in the windshield lets smoke in only at a small rate at the hole, more for a bigger round', () => {
    const { item, d } = make()
    d.hit(bullet(d, 'windshield', [0, 3, 6], 500, 9))
    const s = d.state().parts.find((p) => p.id === 'windshield')!
    expect(s.holes.length).toBe(1)
    const e = cabinEnclosure(d, { frame: item.root })!
    const holes = e.openings!.filter((o) => o.rate !== undefined)
    expect(holes.length).toBe(1)
    expect(holes[0]!.rate!).toBeGreaterThan(0)
    expect(holes[0]!.rate!).toBeLessThan(1)
    // the patch is at the hole, on the windshield
    const glass = local(e, d.partWorldCenter('windshield'))
    expect(Math.hypot(...holes[0]!.center.map((v, a) => v - glass[a]!))).toBeLessThan(0.6)
    // the crack round the hole opens the gaps a little more
    expect(e.leak!).toBeGreaterThan(0.02)
    const big = make()
    big.d.hit(bullet(big.d, 'windshield', [0, 3, 6], 3000, 18.5))
    const slug = cabinEnclosure(big.d, { frame: big.item.root })!.openings!.filter((o) => o.rate !== undefined)
    expect(slug[0]!.rate!).toBeGreaterThan(holes[0]!.rate!)
  })

  it('a vehicle with no cabin (a bike) holds nothing', () => {
    const { item, d } = make('bike')
    expect(cabinEnclosure(d, { frame: item.root })).toBeNull()
  })
})
