import { describe, expect, it } from 'vitest'

import { createPhysicsInputMapper, createSemiSimDriver, defaultSemiSpec, resistanceImpulse, vehicleDescFromSemi } from '../src/index'
import type { SemiSimSpec } from '../src/index'

const SHAPE = { kind: 'box', half: [0.9, 0.35, 2.2] } as const
const chassis = { shape: SHAPE, position: [0, 0.8, 0], user: 1 } as const
const car = (condition = {}) => vehicleDescFromSemi(defaultSemiSpec, { chassis, condition })

describe('vehicleDescFromSemi: the semi-simulation car as an engine vehicle', () => {
  it('puts the wheels where the spec has them: x to the left (the spec has z to the right), z ahead, the front pair first', () => {
    const { wheels } = car()
    expect(wheels).toHaveLength(4)
    expect(wheels[0]!.position[0]).toBeCloseTo(0.75, 9)
    expect(wheels[1]!.position[0]).toBeCloseTo(-0.75, 9)
    expect(wheels[0]!.position[2]).toBeCloseTo(1.3, 9)
    expect(wheels[2]!.position[2]).toBeCloseTo(-1.3, 9)
  })

  it('puts the wheel centre on the ground when the chassis stands at the spec\'s sag: top of the spring minus the loaded length is radius minus centre height', () => {
    const spec = defaultSemiSpec
    const wheel = car().wheels[0]!
    const sag = (spec.mass / 4) * 9.81 / spec.suspension.spring
    const loadedLength = spec.suspension.restLength - sag
    expect(wheel.position[1] - loadedLength).toBeCloseTo(spec.wheelRadius - spec.centreHeight, 9)
    expect(wheel.suspensionMax).toBe(spec.suspension.restLength)
    expect(wheel.suspensionMin).toBeLessThan(loadedLength)
  })

  it('turns the spring and the damper into a frequency and a damping ratio of the corner mass', () => {
    const spec = defaultSemiSpec
    const wheel = car().wheels[0]!
    const corner = spec.mass / 4
    expect(wheel.frequency).toBeCloseTo(Math.sqrt(spec.suspension.spring / corner) / (2 * Math.PI), 9)
    expect(wheel.damping).toBeCloseTo(spec.suspension.damper / (2 * Math.sqrt(spec.suspension.spring * corner)), 9)
  })

  it('steers only the wheels that steer, drives only the ones that drive (the semi-simulation\'s rear drive), the handbrake locks the rear pair', () => {
    const { wheels } = car()
    expect(wheels.map((wheel) => wheel.maxSteer > 0)).toEqual([true, true, false, false])
    expect(wheels.map((wheel) => wheel.driven)).toEqual([false, false, true, true])
    expect(wheels.map((wheel) => wheel.maxHandBrakeTorque > 0)).toEqual([false, false, true, true])
  })

  it('splits the brake force 60/40 between the axles, a wheel radius from the ground', () => {
    const spec = defaultSemiSpec
    const { wheels } = car()
    const total = wheels.reduce((sum, wheel) => sum + wheel.maxBrakeTorque, 0)
    expect(total).toBeCloseTo(spec.brakeForce * spec.wheelRadius, 6)
    expect(wheels[0]!.maxBrakeTorque * 2).toBeCloseTo(0.6 * spec.brakeForce * spec.wheelRadius, 6)
  })

  it('gives the mass and the moments of the spec, with the centre of mass at the origin', () => {
    const { chassis: body } = car()
    expect(body.mass).toBe(defaultSemiSpec.mass)
    expect(body.centreAtOrigin).toBe(true)
    expect(body.motion).toBe('dynamic')
    const [pitch, yaw, roll] = body.inertia!
    expect(yaw).toBeCloseTo((defaultSemiSpec.mass * (2.6 * 2.6 + 1.5 * 1.5)) / 12, 6)
    expect(pitch).toBeGreaterThan(0)
    expect(roll).toBeGreaterThan(0)
  })

  it('the engine: idle to redline, the spec\'s torque times its efficiency, the gears and the final drive, the shift points as shares of the redline', () => {
    const spec = defaultSemiSpec
    const desc = car()
    expect(desc.minRpm).toBe(spec.engine.idleRpm)
    expect(desc.maxRpm).toBe(spec.engine.redlineRpm)
    expect(desc.maxTorque).toBeCloseTo(spec.engine.peakTorque * spec.efficiency, 9)
    expect(desc.gears).toEqual(spec.gears)
    expect(desc.reverseGears).toEqual([-spec.reverseRatio])
    expect(desc.differentialRatio).toBe(spec.finalDrive)
    expect(desc.transmission?.shiftUpRpm).toBeCloseTo(spec.engine.redlineRpm * spec.upshiftFraction, 9)
    expect(desc.transmission?.shiftDownRpm).toBeCloseTo(spec.engine.redlineRpm * spec.downshiftFraction, 9)
  })

  it('the torque curve is the semi-simulation\'s: 0.7 at idle, 1 at the peak, 0.6 just under the redline, 0 at it', () => {
    const curve = car().torqueCurve!
    const at = (fraction: number): number => {
      for (let i = 1; i < curve.length; i++) {
        const [x0, y0] = curve[i - 1]!
        const [x1, y1] = curve[i]!
        if (fraction <= x1) return y0 + ((y1 - y0) * (fraction - x0)) / (x1 - x0)
      }
      return curve[curve.length - 1]![1]
    }
    const spec = defaultSemiSpec
    expect(at(spec.engine.idleRpm / spec.engine.redlineRpm)).toBeCloseTo(0.7, 6)
    expect(at(spec.engine.peakRpm / spec.engine.redlineRpm)).toBeCloseTo(1, 6)
    expect(at((spec.engine.redlineRpm - 1) / spec.engine.redlineRpm)).toBeCloseTo(0.6, 3)
    expect(curve[curve.length - 1]).toEqual([1, 0])
    // and it matches the driver's own torque at every rpm, not only at the corners
    for (const rpm of [900, 1500, 3000, 4200, 5000, 6000]) expect(at(rpm / spec.engine.redlineRpm) * spec.engine.peakTorque).toBeCloseTo(spec.engine.peakTorque * (rpm <= spec.engine.peakRpm ? 0.7 + (0.3 * (rpm - spec.engine.idleRpm)) / (spec.engine.peakRpm - spec.engine.idleRpm) : 1 - (0.4 * (rpm - spec.engine.peakRpm)) / (spec.engine.redlineRpm - spec.engine.peakRpm)), 4)
  })

  it('the tyre curves: lateral peaks at mu over the cornering stiffness (degrees) and eases to 0.75 sideways; longitudinal peaks at 6% slip', () => {
    const wheel = car().wheels[0]!
    const mu = defaultSemiSpec.tyre.friction
    expect(wheel.lateralFriction).toEqual([[0, 0], [((mu / defaultSemiSpec.tyre.corneringStiffness) * 180) / Math.PI, mu], [90, 0.75 * mu]])
    expect(wheel.longitudinalFriction).toEqual([[0, 0], [0.06, mu], [1, 0.8 * mu]])
  })

  it('a flat tyre and a bare rim ride on the rim\'s radius with the rim\'s grip, on that wheel only', () => {
    const spec = defaultSemiSpec
    const flat = car({ tyres: [1, 0.1, 1, 1] }).wheels
    expect(flat[1]!.radius).toBeCloseTo(spec.wheelRadius * 0.7, 9)
    expect(flat[1]!.longitudinalFriction![1]![1]).toBeCloseTo(0.4, 9)
    expect(flat[0]!.radius).toBe(spec.wheelRadius)
    const rim = car({ tyres: [1, 1, 1, 1], rims: [false, false, true, false] }).wheels
    expect(rim[2]!.radius).toBeCloseTo(spec.wheelRadius * 0.7, 9)
    expect(rim[3]!.radius).toBe(spec.wheelRadius)
  })

  it('a worn engine, brakes and suspension give less, at the semi-simulation\'s own floors', () => {
    const worn = car({ engine: 0, brakes: 0.5, suspension: 0 })
    const whole = car()
    expect(worn.maxTorque).toBeCloseTo(whole.maxTorque * 0.55, 9)
    expect(worn.wheels[0]!.maxBrakeTorque).toBeCloseTo(whole.wheels[0]!.maxBrakeTorque * 0.5, 9)
    expect(worn.wheels[0]!.frequency).toBeLessThan(whole.wheels[0]!.frequency)
  })

  it('two wheels make a motorcycle with a lean spring that follows its roll inertia', () => {
    const bike: SemiSimSpec = { ...defaultSemiSpec, mass: 200, wheels: [{ x: 0.7, z: 0, steer: true }, { x: -0.7, z: 0, drive: true }], fourWheelDrive: false }
    const desc = vehicleDescFromSemi(bike, { chassis })
    expect(desc.controller).toBe('motorcycle')
    expect(desc.motorcycle?.leanSpring).toBeCloseTo(400 * desc.chassis.inertia![2]!, 6)
    expect(car().controller).toBeUndefined()
  })

  it('a bicycle: the cyclist is the engine, flat torque from a standing start, no idle, the gears as turns of the engine per wheel turn', () => {
    const bicycle: SemiSimSpec = { ...defaultSemiSpec, mass: 90, wheelRadius: 0.34, wheels: [{ x: 0.55, z: 0, steer: true }, { x: -0.55, z: 0, drive: true }], fourWheelDrive: false, efficiency: 0.95 }
    const desc = vehicleDescFromSemi(bicycle, { chassis, pedal: { watts: 250, cadenceRpm: 80, gears: [1.5, 2.5, 3.5] } })
    expect(desc.minRpm).toBe(0)
    expect(desc.maxTorque).toBeCloseTo((250 / ((80 * 2 * Math.PI) / 60)) * 0.95, 9)
    expect(desc.gears).toEqual([1 / 1.5, 1 / 2.5, 1 / 3.5])
    expect(desc.differentialRatio).toBe(1)
    expect(desc.torqueCurve![0]).toEqual([0, 1])
  })

  it('the mass the driver uses is the mass the engine gets, so the two models weigh the same car', () => {
    const driver = createSemiSimDriver()
    expect(car().chassis.mass).toBe(driver.spec.mass)
  })
})

describe('createPhysicsInputMapper: pedals, steering and the vehicle\'s state to the engine\'s input', () => {
  const press = (patch: Partial<Parameters<ReturnType<typeof createPhysicsInputMapper>['map']>[0]['input']>) => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...patch })

  it('throttle goes forward, scaled by the power limit of traction control', () => {
    const mapper = createPhysicsInputMapper()
    expect(mapper.map({ input: press({ throttle: 1 }), speed: 5, dt: 1 / 60 }).forward).toBe(1)
    expect(mapper.map({ input: press({ throttle: 1, powerLimit: 0.35 }), speed: 5, dt: 1 / 60 }).forward).toBeCloseTo(0.35, 9)
  })

  it('brake against a forward move brakes; from a stop (under 0.5 m/s) it reverses; throttle against a reverse move brakes', () => {
    const mapper = createPhysicsInputMapper()
    const braking = mapper.map({ input: press({ brake: 1 }), speed: 8, dt: 1 / 60 })
    expect(braking.brake).toBe(1)
    expect(braking.forward).toBe(0)
    const reversing = mapper.map({ input: press({ brake: 0.6 }), speed: 0.3, dt: 1 / 60 })
    expect(reversing.forward).toBeCloseTo(-0.6, 9)
    expect(reversing.brake).toBe(0)
    const rolling = mapper.map({ input: press({ brake: 1 }), speed: -3, dt: 1 / 60 })
    expect(rolling.forward).toBe(-1)
    const against = mapper.map({ input: press({ throttle: 1 }), speed: -3, dt: 1 / 60 })
    expect(against.brake).toBe(1)
    expect(against.forward).toBe(0)
  })

  it('throttle and brake together cancel into the larger one', () => {
    const mapper = createPhysicsInputMapper()
    const out = mapper.map({ input: press({ throttle: 1, brake: 0.4 }), speed: 5, dt: 1 / 60 })
    expect(out.forward).toBeCloseTo(0.6, 9)
    expect(out.brake).toBe(0)
  })

  it('a vehicle that cannot drive gets no throttle and no reverse, but its brake and handbrake work', () => {
    const mapper = createPhysicsInputMapper()
    expect(mapper.map({ input: press({ throttle: 1 }), speed: 0, dt: 1 / 60, status: { canDrive: false } }).forward).toBe(0)
    const out = mapper.map({ input: press({ brake: 1, handbrake: true }), speed: 8, dt: 1 / 60, status: { canDrive: false } })
    expect(out.brake).toBe(1)
    expect(out.handBrake).toBe(1)
  })

  it('worn brakes brake by the inverse of their factor (stopping distance that many times longer)', () => {
    const mapper = createPhysicsInputMapper()
    expect(mapper.map({ input: press({ brake: 1 }), speed: 8, dt: 1 / 60, status: { brakeFactor: 2 } }).brake).toBeCloseTo(0.5, 9)
    expect(mapper.map({ input: press({ brake: 1 }), speed: 8, dt: 1 / 60, status: { brakeFactor: 1 } }).brake).toBe(1)
  })

  it('the kit\'s positive-left steer is the engine\'s negative right, filtered at the arcade\'s 5 per second', () => {
    const mapper = createPhysicsInputMapper()
    const first = mapper.map({ input: press({ steer: 1 }), speed: 0, dt: 0.1 })
    expect(first.right).toBeCloseTo(-0.5, 9)
    let last = first.right
    for (let i = 0; i < 60; i++) last = mapper.map({ input: press({ steer: 1 }), speed: 0, dt: 0.1 }).right
    expect(last).toBeCloseTo(-1, 3)
    expect(mapper.map({ input: press({ steer: -1 }), speed: 0, dt: 10 }).right).toBeCloseTo(1, 9)
  })

  it('the lock shrinks with the speed down to a floor, and the filter forgets on reset', () => {
    const mapper = createPhysicsInputMapper()
    const at = (speed: number): number => {
      mapper.reset()
      return -mapper.map({ input: press({ steer: 1 }), speed, dt: 10 }).right
    }
    expect(at(0)).toBe(1)
    expect(at(25)).toBeCloseTo(1 - 0.012 * 25, 9)
    expect(at(200)).toBeCloseTo(0.4, 9)
  })

  it('a damaged steering pulls to its side whatever the wheel says: -1 (left) adds to the right input a share of full lock', () => {
    const mapper = createPhysicsInputMapper()
    const out = mapper.map({ input: press({}), speed: 10, dt: 1 / 60, status: { steerPull: -1 } })
    expect(out.right).toBeCloseTo(-0.2, 9)
  })
})

describe('resistanceImpulse: the air and the tyres', () => {
  const spec = { drag: 0.4, rolling: 0.015, mass: 1300 }

  it('opposes the horizontal velocity by the air drag and the rolling resistance, over the step', () => {
    const impulse = resistanceImpulse(spec, [0, 0, 20], 1 / 60)
    expect(impulse[0]).toBeCloseTo(0, 12)
    expect(impulse[1]).toBeCloseTo(0, 12)
    expect(impulse[2]).toBeCloseTo(-(0.4 * 400 + 0.015 * 1300 * 9.81) / 60, 9)
  })

  it('follows the direction of the velocity, ignores the vertical part, and is nothing at rest', () => {
    const impulse = resistanceImpulse(spec, [3, -9, 4], 0.1)
    expect(impulse[0] / impulse[2]).toBeCloseTo(0.75, 9)
    expect(impulse[1]).toBe(0)
    expect(resistanceImpulse(spec, [0, 0, 0], 0.1)).toEqual([0, 0, 0])
  })

  it('fades the rolling resistance under 0.5 m/s so it never turns the velocity around', () => {
    const slow = resistanceImpulse(spec, [0, 0, 0.1], 1 / 60)
    expect(Math.abs(slow[2]!)).toBeLessThan((0.015 * 1300 * 9.81) / 60 / 4)
  })
})
