import { describe, expect, it } from 'vitest'

import { CONTACT_READ_STRIDE, WHEEL_READ, WHEEL_READ_STRIDE } from '@adatechnology/game-physics'
import type { BodyId, RayHit, ShapeDesc, VehicleDesc, Vec3, WheelDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground, report } from './scenes'

/** T6.1b: the contract a car's hulls, wheels and layers need (veiculos.md 6.4). */

const world = async (): Promise<JoltWorld> => {
  const w = (await createJoltEngine()).createWorld({ fixedStep: 1 / 120 }) as JoltWorld
  ground(w, 80)
  return w
}

const HULLS = 8
const hullAt = (i: number): Vec3 => [(i % 4) * 0.5 - 0.75, 0.25, Math.floor(i / 4) * 1.0 - 0.5]
/** A "car" of eight box hulls in two rows, each tagged by its index. */
const compound = (mutable = false): ShapeDesc => ({
  kind: 'compound',
  ...(mutable ? { mutable: true } : {}),
  children: Array.from({ length: HULLS }, (_, i) => ({ shape: { kind: 'box', half: [0.25, 0.25, 0.5] } as ShapeDesc, position: hullAt(i), tag: i })),
})

const hits = (w: JoltWorld, from: Vec3, direction: Vec3, length = 10): RayHit[] => {
  const out: RayHit[] = []
  w.rayAll(from, direction, length, out)
  return out
}

describe('a shape shared by bodies that stay whole', () => {
  it('is made once, used by many bodies, and a body that is damaged gets a copy of its own', async () => {
    const w = await world()
    const shared = w.createSharedShape(compound())
    const make = (x: number): BodyId => w.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 800, position: [x, 3, 0], user: 7, sleeping: true })
    const a = make(0)
    const b = make(10)
    // a ray through child 0 of each (child 0 is the one at x -0.75, z -0.5)
    const ray = (x: number): RayHit[] => hits(w, [x - 0.75, 3 + 0.25, -5], [0, 0, 1])
    expect(ray(0).map((h) => h.tag)).toContain(0)
    expect(ray(10).map((h) => h.tag)).toContain(0)
    w.setChildShape(a, 0, null)
    expect(ray(0).map((h) => h.tag)).not.toContain(0)
    expect(ray(10).map((h) => h.tag)).toContain(0)
    // the rest of the damaged car is where it was, and the whole one still holds the shape the world kept
    expect(hits(w, [0.75, 3.25, -5], [0, 0, 1]).map((h) => h.tag)).toContain(3)
    w.releaseSharedShape(shared)
    expect(ray(10).map((h) => h.tag)).toContain(0)
    expect(w.has(b)).toBe(true)
    w.dispose()
  })

  it('keeps a child by its handle when another one goes, and replaces it where it is or at a pose', async () => {
    const w = await world()
    const car = w.createBody({ shape: compound(true), motion: 'dynamic', mass: 800, position: [0, 3, 0], user: 1, sleeping: true })
    w.setChildShape(car, 0, null)
    w.setChildShape(car, 1, null)
    // child 5 is still child 5: x -0.25, z 0.5 (row 1, column 1); a taller hull there (half height 0.6) reaches y 3 + 0.25 + 0.6
    const before = hits(w, [-0.25, 6, 0.5], [0, -1, 0])
    expect(before[0]?.tag).toBe(5)
    const topBefore = 6 - (before[0]?.distance ?? 0)
    w.setChildShape(car, 5, { kind: 'box', half: [0.25, 0.6, 0.5] })
    const after = hits(w, [-0.25, 6, 0.5], [0, -1, 0])
    expect(after[0]?.tag).toBe(5)
    expect(6 - (after[0]?.distance ?? 0)).toBeGreaterThan(topBefore + 0.3)
    // moved to a pose: the old place is empty and the new one answers with the same tag
    w.setChildShape(car, 5, { kind: 'box', half: [0.25, 0.25, 0.5] }, { position: [-0.25, 0.25, 4] })
    expect(hits(w, [-0.25, 6, 0.5], [0, -1, 0]).map((h) => h.tag)).not.toContain(5)
    expect(hits(w, [-0.25, 6, 4], [0, -1, 0])[0]?.tag).toBe(5)
    expect(() => w.setChildShape(car, 0, null)).toThrow(/no child 0/)
    expect(() => w.setChildShape(w.createBody({ shape: { kind: 'box', half: [1, 1, 1] }, motion: 'static', position: [30, 1, 0], user: 2 }), 0, null)).toThrow(/no compound/)
    w.dispose()
  })

  it('keeps the kit mass when the shape changes, and the car settles on the ground', async () => {
    const w = await world()
    const shared = w.createSharedShape(compound())
    const car = w.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 800, inertia: [200, 300, 250], position: [0, 1, 0], user: 1 })
    for (let i = 0; i < 40; i++) w.step(1 / 60)
    w.setChildShape(car, 2, null)
    const mass = w.massProperties(car)
    expect(mass.mass).toBeCloseTo(800, 3)
    expect(mass.inertia[0]).toBeCloseTo(200, 1)
    for (let i = 0; i < 120; i++) w.step(1 / 60)
    const pose = new Float64Array(7)
    w.readPose(car, pose, 0)
    // the hulls' bottoms are at the origin's height: resting on the ground is an origin at 0
    expect(Math.abs(pose[1])).toBeLessThan(0.05)
    w.dispose()
  })
})

describe('mass properties', () => {
  it('sets mass and inertia, and moves the centre of mass without moving the shape', async () => {
    const w = await world()
    const car = w.createBody({ shape: compound(true), motion: 'dynamic', mass: 800, inertia: [200, 300, 250], position: [0, 5, 0], user: 1, sleeping: true })
    const top = (): number => 7 - (hits(w, [-0.75, 7, -0.5], [0, -1, 0])[0]?.distance ?? 0)
    const centre = (): Vec3 => {
      const at = w.entry(car).body.GetCenterOfMassPosition()
      return [at.GetX(), at.GetY(), at.GetZ()]
    }
    const topBefore = top()
    // the shape's own centre of mass is the middle of the hulls, 0.25 above the origin
    expect(centre()[1]).toBeCloseTo(5.25, 4)
    w.setMassProperties(car, { mass: 650, inertia: [150, 220, 190], centreOfMass: [0.1, -0.2, 0.3] })
    const mass = w.massProperties(car)
    expect(mass.mass).toBeCloseTo(650, 3)
    expect(mass.inertia[0]).toBeCloseTo(150, 1)
    expect(mass.inertia[1]).toBeCloseTo(220, 1)
    // the origin of the shape is at (0, 5, 0): the centre of mass is where the kit said, and the shape did not move
    const moved = centre()
    expect(moved[0]).toBeCloseTo(0.1, 4)
    expect(moved[1]).toBeCloseTo(4.8, 4)
    expect(moved[2]).toBeCloseTo(0.3, 4)
    expect(top()).toBeCloseTo(topBefore, 3)
    // set again it is the same wrapper made again, not one inside another
    w.setMassProperties(car, { mass: 600, inertia: [150, 220, 190], centreOfMass: [0, 0, 0] })
    expect(centre()[1]).toBeCloseTo(5, 4)
    expect(top()).toBeCloseTo(topBefore, 3)
    // without a centre of mass it is left where it is
    w.setMassProperties(car, { mass: 500, inertia: [100, 100, 100] })
    expect(centre()[1]).toBeCloseTo(5, 4)
    expect(w.massProperties(car).mass).toBeCloseTo(500, 3)
    w.dispose()
  })
})

describe('motion quality', () => {
  it('linear cast stops a fast small body at a thin wall that the plain kind goes through', async () => {
    const run = async (quality: 'discrete' | 'linearCast'): Promise<number> => {
      const w = await world()
      w.createBody({ shape: { kind: 'box', half: [5, 5, 0.01] }, motion: 'static', position: [0, 2, 10.5], user: 1 })
      const piece = w.createBody({ shape: { kind: 'sphere', radius: 0.05 }, motion: 'dynamic', mass: 1, position: [0, 2, 0], linearVelocity: [0, 0, 300], user: 2 })
      w.setMotionQuality(piece, quality)
      const pose = new Float64Array(7)
      for (let i = 0; i < 10; i++) w.step(1 / 60)
      w.readPose(piece, pose, 0)
      w.dispose()
      return pose[2]
    }
    expect(await run('discrete')).toBeGreaterThan(11)
    expect(await run('linearCast')).toBeLessThan(10.5)
  })
})

describe('watched contacts', () => {
  it('keeps the points with a normal out of the other body and a depth, only for the body watched', async () => {
    const w = await world()
    const box = w.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 20, position: [0, 0.6, 0], user: 1 })
    const other = w.createBody({ shape: { kind: 'box', half: [0.5, 0.5, 0.5] }, motion: 'dynamic', mass: 20, position: [5, 0.6, 0], user: 2 })
    const out = new Float32Array(CONTACT_READ_STRIDE * 16)
    expect(w.readContacts(box, out)).toBe(0)
    w.watchContacts(box, true)
    for (let i = 0; i < 30; i++) w.step(1 / 60)
    const n = w.readContacts(box, out)
    expect(n).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < n; i++) {
      expect(out[i * CONTACT_READ_STRIDE + 4]).toBeGreaterThan(0.99)
      expect(out[i * CONTACT_READ_STRIDE + 6]).toBeGreaterThanOrEqual(-0.01)
      expect(out[i * CONTACT_READ_STRIDE + 1]).toBeLessThan(0.1)
    }
    expect(w.readContacts(other, out)).toBe(0)
    w.watchContacts(box, false)
    for (let i = 0; i < 2; i++) w.step(1 / 60)
    expect(w.readContacts(box, out)).toBe(0)
    w.dispose()
  })
})

const WHEEL: Omit<WheelDesc, 'position' | 'maxSteer' | 'driven'> = { radius: 0.3, width: 0.2, suspensionMin: 0.05, suspensionMax: 0.25, frequency: 1.5, damping: 0.5, maxBrakeTorque: 1500, maxHandBrakeTorque: 0 }
const car = (wheels: number, at: Vec3 = [0, 1, 0]): VehicleDesc => ({
  chassis: { shape: { kind: 'box', half: [0.8, 0.3, 2] }, motion: 'dynamic', position: at, mass: 1000, user: 2 },
  wheels: ([[0.7, 1.4], [-0.7, 1.4], [0.7, -1.4], [-0.7, -1.4]] as const).slice(0, wheels).map(([x, z], i) => ({ ...WHEEL, position: [x, -0.3, z] as Vec3, maxSteer: i < 2 ? 0.6 : 0, driven: i < 2 })),
  maxTorque: 160, minRpm: 1000, maxRpm: 6000, gears: [3.5, 2.0, 1.4], reverseGears: [-3.3], differentialRatio: 4.2, antiRoll: 1000,
})

describe('the wheels of a vehicle', () => {
  it('are read: contact, the ground body, spin, suspension, slip and the three impulses', async () => {
    const w = await world()
    const id = w.createVehicle(car(4))
    const out = new Float64Array(WHEEL_READ_STRIDE * 4)
    expect(w.vehicleWheels(id, out)).toBe(4)
    for (let i = 0; i < 120; i++) w.step(1 / 120)
    w.vehicleWheels(id, out)
    for (let i = 0; i < 4; i++) {
      const at = i * WHEEL_READ_STRIDE
      expect(out[at + WHEEL_READ.CONTACT]).toBe(1)
      expect(out[at + WHEEL_READ.BODY]).toBeGreaterThanOrEqual(0)
      expect(out[at + WHEEL_READ.COMPRESSION]).toBeGreaterThanOrEqual(0.05)
      expect(out[at + WHEEL_READ.COMPRESSION]).toBeLessThanOrEqual(0.25)
      expect(out[at + WHEEL_READ.SUSPENSION_IMPULSE]).toBeGreaterThan(0)
    }
    for (let i = 0; i < 240; i++) {
      w.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      w.step(1 / 120)
    }
    w.vehicleWheels(id, out)
    expect(out[WHEEL_READ.SPIN]).toBeGreaterThan(1)
    expect(Number.isFinite(out[WHEEL_READ.LONGITUDINAL_IMPULSE])).toBe(true)
    expect(Number.isFinite(out[WHEEL_READ.SLIP_LATERAL])).toBe(true)
    expect(Number.isFinite(out[WHEEL_READ.SLIP_LONGITUDINAL])).toBe(true)
    expect(w.vehicleWheels(999 as never, out)).toBe(0)
    report('vehicle-wheels-read', { spin: out[WHEEL_READ.SPIN], slipLongitudinal: out[WHEEL_READ.SLIP_LONGITUDINAL], compression: out[WHEEL_READ.COMPRESSION] })
    w.dispose()
  })

  it('are made again over the same chassis: a wheel lost, the body, its pose and its speed kept', async () => {
    const w = await world()
    const id = w.createVehicle(car(4))
    const body = w.vehicleBody(id)
    for (let i = 0; i < 120; i++) w.step(1 / 120)
    for (let i = 0; i < 240; i++) {
      w.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      w.step(1 / 120)
    }
    const before = new Float64Array(7)
    const speedBefore = new Float64Array(6)
    w.readPose(body, before, 0)
    w.readVelocity(body, speedBefore, 0)
    w.rebuildVehicle(id, car(3))
    expect(w.vehicleBody(id)).toBe(body)
    const after = new Float64Array(7)
    w.readPose(body, after, 0)
    expect(after[2]).toBeCloseTo(before[2], 6)
    const out = new Float64Array(WHEEL_READ_STRIDE * 4)
    expect(w.vehicleWheels(id, out)).toBe(3)
    expect(w.wheelContacts(id)).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 120; i++) {
      w.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
      w.step(1 / 120)
    }
    w.readPose(body, after, 0)
    expect(after[2]).toBeGreaterThan(before[2] + 1)
    w.removeVehicle(id)
    expect(w.has(body)).toBe(false)
    expect(() => w.rebuildVehicle(id, car(4))).toThrow(/no vehicle/)
    w.dispose()
  })
})

describe('layers', () => {
  it('a vehicle does not meet an agent, and its wheels do not stand on one', async () => {
    const through = async (layer: 'agent' | 'prop'): Promise<number> => {
      const w = await world()
      w.createBody({ shape: { kind: 'box', half: [3, 0.1, 5] }, motion: 'static', layer, position: [0, 0.6, 0], user: 5 })
      const id = w.createVehicle(car(4, [0, 2.5, 0]))
      for (let i = 0; i < 360; i++) w.step(1 / 120)
      const pose = new Float64Array(7)
      w.readPose(w.vehicleBody(id), pose, 0)
      w.dispose()
      return pose[1]
    }
    // on a prop slab 0.7 m up the car stays on it; on an agent slab it goes through to the ground
    expect(await through('prop')).toBeGreaterThan(1.1)
    expect(await through('agent')).toBeLessThan(0.9)
  })

  it('a vehicle driven into an agent is not stopped by it, into a prop it is', async () => {
    const drive = async (layer: 'agent' | 'prop'): Promise<number> => {
      const w = await world()
      w.createBody({ shape: { kind: 'box', half: [3, 1, 0.2] }, motion: 'static', layer, position: [0, 1, 12], user: 5 })
      const id = w.createVehicle({ ...car(4, [0, 0.8, 0]), chassis: { ...car(4).chassis, position: [0, 0.8, 0], linearVelocity: [0, 0, 15] } })
      for (let i = 0; i < 360; i++) {
        w.driveVehicle(id, { forward: 1, right: 0, brake: 0, handBrake: 0 })
        w.step(1 / 120)
      }
      const pose = new Float64Array(7)
      w.readPose(w.vehicleBody(id), pose, 0)
      w.dispose()
      return pose[2]
    }
    expect(await drive('agent')).toBeGreaterThan(14)
    expect(await drive('prop')).toBeLessThan(11)
  })
})
