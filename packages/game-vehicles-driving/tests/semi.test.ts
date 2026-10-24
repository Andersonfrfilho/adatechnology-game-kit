import { describe, expect, it } from 'vitest'
import { bodyDamage, createSemiSimDriver, createSurfaces, defaultSurfaces, fuelRate, impactEnergy, speedLoss, surfaceGrip, vehicleDamageFromImpact, defaultFuelModel } from '../src'
import type { SemiInput, SemiSimSpec, SemiWorld } from '../src'

const DT = 1 / 60
const coast: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
const surfaceWorld = (id: string): SemiWorld => ({ ground: () => ({ surface: id }) })

function drive(spec: Partial<SemiSimSpec>, input: SemiInput, seconds: number, world: SemiWorld = {}, setup?: (d: ReturnType<typeof createSemiSimDriver>) => void) {
  const driver = createSemiSimDriver(spec)
  setup?.(driver)
  const events: string[] = []
  for (let t = 0; t < seconds; t += DT) events.push(...driver.step(input, DT, world).events.map((e) => e.type))
  return { driver, events }
}

/** Reaches `kmh` with an automatic car, then returns the driver (settled). */
function atSpeed(kmh: number, spec: Partial<SemiSimSpec> = {}, world: SemiWorld = {}) {
  const driver = createSemiSimDriver(spec)
  driver.state.u = kmh / 3.6
  for (let t = 0; t < 1; t += DT) driver.step({ ...coast, throttle: 0.3 }, DT, world)
  driver.state.u = kmh / 3.6
  return driver
}

function brakingDistance(surface: string, kmh: number): number {
  const driver = atSpeed(kmh, {}, surfaceWorld(surface))
  const start = driver.state.x
  for (let t = 0; t < 30 && driver.state.u > 0.1; t += DT) driver.step({ ...coast, brake: 1 }, DT, surfaceWorld(surface))
  return driver.state.x - start
}

describe('surfaces of the Frota document', () => {
  it('has the grip table: dry 1.0, wet 0.75, dirt 0.65, grass 0.55, mud 0.4, blood 0.5', () => {
    const grip = Object.fromEntries(defaultSurfaces.map((s) => [s.id, s.grip]))
    expect(grip).toEqual({ dry_asphalt: 1, wet_asphalt: 0.75, dirt: 0.65, grass: 0.55, mud: 0.4, blood: 0.5 })
    expect(defaultSurfaces.find((s) => s.id === 'mud')?.bogs).toBe(true)
  })

  it('aquaplanes the wet asphalt above 90 km/h and not below', () => {
    const wet = createSurfaces().get('wet_asphalt')
    expect(surfaceGrip(wet, 80 / 3.6)).toBe(0.75)
    expect(surfaceGrip(wet, 90 / 3.6)).toBe(0.75)
    expect(surfaceGrip(wet, 110 / 3.6)).toBeLessThan(0.75 * 0.7)
    expect(surfaceGrip(createSurfaces().get('dry_asphalt'), 200 / 3.6)).toBe(1)
  })

  it('takes packs, patches and removals by id', () => {
    const surfaces = createSurfaces({ packs: [{ surfaces: [{ id: 'ice', grip: 0.15 }] }], patch: { mud: { grip: 0.3 } }, remove: ['blood'] })
    expect(surfaces.get('ice').grip).toBe(0.15)
    expect(surfaces.get('mud').grip).toBe(0.3)
    expect(surfaces.surfaces.map((s) => s.id)).not.toContain('blood')
    expect(surfaces.get('nowhere').id).toBe('dry_asphalt')
  })
})

describe('semi-simulation driver', () => {
  it('rests on its springs without creeping', () => {
    const { driver } = drive({}, coast, 3)
    expect(Math.abs(driver.state.u)).toBeLessThan(0.01)
    expect(Math.abs(driver.state.pitch)).toBeLessThan(0.01)
    const total = driver.state.loads.reduce((a, b) => a + b, 0)
    expect(total / 9.81).toBeCloseTo(1300, -1)
  })

  it('accelerates through the gears with a simulated RPM and reaches a speed that air drag limits', () => {
    const { driver, events } = drive({}, { ...coast, throttle: 1 }, 20)
    expect(driver.state.u * 3.6).toBeGreaterThan(120)
    expect(driver.state.u * 3.6).toBeLessThan(260)
    expect(driver.state.gear).toBeGreaterThan(2)
    expect(events.filter((e) => e === 'shift').length).toBeGreaterThanOrEqual(3)
    expect(driver.state.rpm).toBeGreaterThan(900)
  })

  it('brakes shorter on dry asphalt than on wet, dirt and mud, in the order of the grip', () => {
    const dry = brakingDistance('dry_asphalt', 80)
    const wet = brakingDistance('wet_asphalt', 80)
    const dirt = brakingDistance('dirt', 80)
    const mud = brakingDistance('mud', 80)
    expect(dry).toBeLessThan(wet)
    expect(wet).toBeLessThan(dirt)
    expect(dirt).toBeLessThan(mud)
    expect(dry).toBeGreaterThan(20)
    expect(dry).toBeLessThan(60)
    expect(mud / dry).toBeGreaterThan(1.8)
  })

  it('loses more than the speed squared on the wet above 90 km/h, because the tyres float', () => {
    const slow = brakingDistance('wet_asphalt', 80)
    const fast = brakingDistance('wet_asphalt', 110)
    expect(fast / slow).toBeGreaterThan((110 / 80) ** 2 * 1.05)
    const dryRatio = brakingDistance('dry_asphalt', 110) / brakingDistance('dry_asphalt', 80)
    expect(fast / slow).toBeGreaterThan(dryRatio * 1.05)
  })

  it('corners with the body rolling to the outside, pitching down under braking', () => {
    const driver = atSpeed(60)
    for (let t = 0; t < 1.5; t += DT) driver.step({ ...coast, throttle: 0.2, steer: -0.5 }, DT)
    expect(driver.state.yawRate).toBeLessThan(0)
    // a right turn rolls the body to the left: the right side comes up (roll counts the right side down)
    expect(driver.state.roll).toBeLessThan(0)
    const braking = atSpeed(80)
    for (let t = 0; t < 0.6; t += DT) braking.step({ ...coast, brake: 0.8 }, DT)
    expect(braking.state.pitch).toBeLessThan(-0.001)
  })

  it('locks the rear wheels with the handbrake and swings the tail', () => {
    const turn = (handbrake: boolean) => {
      const d = atSpeed(70)
      for (let t = 0; t < 1.2; t += DT) d.step({ ...coast, steer: 0.6, handbrake }, DT)
      return d
    }
    const free = turn(false)
    const locked = turn(true)
    expect(Math.abs(locked.state.yawRate)).toBeGreaterThan(Math.abs(free.state.yawRate) * 1.2)
    expect(locked.state.slip[2]).toBeGreaterThan(0.95)
  })

  it('bogs a two-wheel-drive vehicle in mud and lets a four-wheel-drive one through', () => {
    const mud = surfaceWorld('mud')
    const twoWheel = drive({}, { ...coast, throttle: 1 }, 8, mud)
    const fourWheel = drive({ fourWheelDrive: true }, { ...coast, throttle: 1 }, 8, mud)
    expect(twoWheel.driver.state.u).toBeLessThan(0.5)
    expect(twoWheel.driver.state.bogged).toBe(true)
    expect(twoWheel.events).toContain('bogged')
    expect(fourWheel.driver.state.u).toBeGreaterThan(2)
    expect(fourWheel.driver.state.bogged).toBe(false)
  })

  it('pulls toward a flat tyre', () => {
    const run = (tyres: number[]) => {
      const d = atSpeed(50)
      d.condition = { tyres }
      for (let t = 0; t < 2; t += DT) d.step({ ...coast, throttle: 0.3 }, DT)
      return d.state.yaw
    }
    const straight = run([1, 1, 1, 1])
    const flatRight = run([1, 1, 1, 0.1])
    const flatLeft = run([1, 0.1, 1, 1])
    void flatLeft
    expect(Math.abs(straight)).toBeLessThan(0.01)
    // wheels 1 and 3 are on the right (z > 0): the drag on that side turns the nose to the right (negative yaw)
    expect(flatRight).toBeLessThan(straight - 0.01)
  })

  it('rolls more with a damaged suspension', () => {
    const roll = (suspension: number) => {
      const d = atSpeed(60)
      d.condition = { suspension }
      let peak = 0
      for (let t = 0; t < 1.5; t += DT) {
        d.step({ ...coast, throttle: 0.2, steer: -0.5 }, DT)
        peak = Math.max(peak, Math.abs(d.state.roll))
      }
      return peak
    }
    expect(roll(0.1)).toBeGreaterThan(roll(1) * 1.2)
  })

  it('fails to accelerate hard with an engine under 30% and can die going uphill', () => {
    const healthy = drive({}, { ...coast, throttle: 1 }, 6)
    const wrecked = drive({}, { ...coast, throttle: 1 }, 6, {}, (d) => {
      d.condition = { engine: 0.2 }
    })
    expect(wrecked.driver.state.u).toBeLessThan(healthy.driver.state.u * 0.6)
    const slope: SemiWorld = { ground: (x) => ({ height: Math.max(0, 0.15 * x) }) }
    const climb = (engine: number): string[] => {
      const d = createSemiSimDriver()
      d.condition = { engine }
      d.state.u = 8
      const events: string[] = []
      for (let t = 0; t < 8; t += DT) events.push(...d.step({ ...coast, throttle: 1 }, DT, slope).events.map((e) => e.type))
      return events
    }
    expect(climb(0.2)).toContain('stall')
    expect(climb(1)).not.toContain('stall')
  })

  it('spends fuel by RPM, load and the state of the engine', () => {
    const rate = (rpm: number, throttle: number, load: number, health: number) => fuelRate(defaultFuelModel, rpm, throttle, load, health)
    expect(rate(0.8, 1, 0, 1)).toBeGreaterThan(rate(0.3, 1, 0, 1))
    expect(rate(0.5, 0.5, 0.5, 1)).toBeCloseTo(rate(0.5, 0.5, 0, 1) * 1.25, 9)
    expect(rate(0.5, 0.5, 0, 0)).toBeCloseTo(rate(0.5, 0.5, 0, 1) * 1.4, 9)
    const light = drive({}, { ...coast, throttle: 0.5 }, 10)
    const loaded = drive({}, { ...coast, throttle: 0.5 }, 10, {}, (d) => d.setCargo(650))
    expect(45 - loaded.driver.state.fuel).toBeGreaterThan(45 - light.driver.state.fuel)
  })

  it('runs out of fuel and stops the engine', () => {
    const { driver, events } = drive({}, { ...coast, throttle: 1 }, 5, {}, (d) => {
      d.state.fuel = 0.001
    })
    expect(events).toContain('out_of_fuel')
    expect(driver.state.engineOn).toBe(false)
    driver.refuel(10)
    expect(driver.state.fuel).toBeCloseTo(10.001 - 0.0000, 2)
  })

  it('takes blood on the road for a few seconds', () => {
    const d = atSpeed(50)
    d.contaminate('blood', 2)
    for (let t = 0; t < 0.5; t += DT) d.step({ ...coast, brake: 1 }, DT)
    expect(d.state.slip.some((s) => s > 0.5)).toBe(true)
  })

  it('reverses from a stop with the brake pedal', () => {
    const { driver } = drive({}, { ...coast, brake: 1 }, 4)
    expect(driver.state.gear).toBe(-1)
    expect(driver.state.u).toBeLessThan(-1)
  })
})

describe('run-over energy (Frota document, section 08)', () => {
  it('is half the mass times the speed squared', () => {
    expect(impactEnergy(1300, 20)).toBe(260000)
    expect(impactEnergy(2000, 10)).toBe(100000)
  })

  it('damages the body by bumper and zone and the vehicle by 4% of the energy minus the armour', () => {
    expect(bodyDamage(1000, 1.5, 2)).toBe(3000)
    expect(vehicleDamageFromImpact(1000, 0)).toBe(40)
    expect(vehicleDamageFromImpact(1000, 0.5)).toBe(20)
  })

  it('takes speed away in proportion to the mass of the body', () => {
    expect(speedLoss(80, 1320, 20)).toBeCloseTo((80 / 1400) * 20, 12)
    expect(speedLoss(80, 1320, 20)).toBeLessThan(speedLoss(800, 1320, 20))
  })
})

describe('spec from the design ratings', () => {
  it('tops out near the design speed and grips more with better handling', async () => {
    const { semiSpecFromStats } = await import('../src')
    const hatch = semiSpecFromStats({ acceleration: 7, handling: 7, maxSpeedKmh: 170 }, { mass: 1100, wheelbase: 2.55, track: 1.5 })
    const truck = semiSpecFromStats({ acceleration: 3, handling: 3, maxSpeedKmh: 100 }, { mass: 6000, wheelbase: 3.9, track: 1.9 })
    const top = (spec: SemiSimSpec): number => {
      const { driver } = drive(spec, { ...coast, throttle: 1 }, 70)
      return driver.state.u * 3.6
    }
    expect(top(hatch)).toBeGreaterThan(170 * 0.8)
    expect(top(hatch)).toBeLessThan(170 * 1.15)
    expect(top(truck)).toBeGreaterThan(100 * 0.7)
    expect(top(truck)).toBeLessThan(100 * 1.15)
    expect(hatch.tyre.friction).toBeGreaterThan(truck.tyre.friction)
  })
})
