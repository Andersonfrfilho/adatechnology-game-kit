import { describe, expect, it } from 'vitest'

import { semiSpecFromStats, vehicleDescFromSemi } from '../src'
import type { BodyDimensions, DesignStats } from '../src'

const stats: DesignStats = { acceleration: 6, handling: 6, maxSpeedKmh: 120 }
const car: BodyDimensions = { mass: 1200, wheelbase: 2.6, track: 1.5 }
const chassis = { shape: { kind: 'box' as const, half: [0.5, 0.3, 1] as const }, position: [0, 1, 0] as const, user: 1 }

describe('the ficha follows the type of the vehicle (T6.2c)', () => {
  it('a body with no type is the four-wheel car it always was', () => {
    const spec = semiSpecFromStats(stats, car)
    expect(spec.wheels).toHaveLength(4)
    expect(spec.tracks).toBeUndefined()
    expect(spec.pedal).toBeUndefined()
    expect(vehicleDescFromSemi(spec, { chassis }).controller).toBeUndefined()
  })

  it('a motorcycle has two wheels on the centre line, the front steering and the rear driving, a rider on board and the motorcycle controller', () => {
    const spec = semiSpecFromStats(stats, { ...car, type: 'motorcycle', mass: 180, wheelbase: 1.3, track: 0.6 })
    expect(spec.wheels.map((wheel) => wheel.z)).toEqual([0, 0])
    expect(spec.wheels.map((wheel) => !!wheel.steer)).toEqual([true, false])
    expect(spec.wheels.map((wheel) => !!wheel.drive)).toEqual([false, true])
    expect(spec.mass).toBe(255)
    expect(vehicleDescFromSemi(spec, { chassis }).controller).toBe('motorcycle')
  })

  it('a truck has the axles of its model: one pair each, the front steering, the others driving, the wheelbase from the first to the last', () => {
    const axles = [{ x: 3.3, track: 2.1, radius: 0.5 }, { x: -1.5, track: 2.1, radius: 0.5 }, { x: -2.7, track: 2.1, radius: 0.5 }]
    const spec = semiSpecFromStats(stats, { ...car, type: 'truck', mass: 12000, axles })
    expect(spec.wheels).toHaveLength(6)
    expect(spec.wheels.filter((wheel) => wheel.steer).map((wheel) => wheel.x)).toEqual([3, 3])
    expect(spec.wheels.filter((wheel) => wheel.drive)).toHaveLength(4)
    expect(spec.wheelRadius).toBe(0.5)
    expect(spec.gears).toHaveLength(5)
    expect(vehicleDescFromSemi(spec, { chassis }).wheels).toHaveLength(6)
  })

  it('a bicycle is a cyclist on two wheels, geared to the top speed at his cadence, and the engine reads the pedal', () => {
    const spec = semiSpecFromStats({ acceleration: 10, handling: 10, maxSpeedKmh: 25 }, { ...car, type: 'bicycle', mass: 100, wheelbase: 1.1, track: 0 })
    expect(spec.pedal?.watts).toBe(250)
    expect(spec.pedal!.gears[2]!).toBeGreaterThan(spec.pedal!.gears[0]!)
    const desc = vehicleDescFromSemi(spec, { chassis })
    expect(desc.minRpm).toBe(0)
    expect(desc.controller).toBe('motorcycle')
  })

  it('a tracked vehicle keeps four wheels for the semi-simulation and gives the engine two tracks of road wheels', () => {
    const tracks = { gauge: 2.65, rearX: -2.67, frontX: 2.55, roadWheels: 7, radius: 0.35 }
    const spec = semiSpecFromStats(stats, { ...car, type: 'tracked', mass: 40000, tracks })
    expect(spec.wheels).toHaveLength(4)
    expect(spec.tracks?.roadWheels).toBe(7)
    const desc = vehicleDescFromSemi(spec, { chassis })
    expect(desc.controller).toBe('tracked')
    expect(desc.wheels).toHaveLength(14)
    expect(desc.tracks?.map((track) => track.wheels.length)).toEqual([7, 7])
  })
})
