import { describe, expect, it } from 'vitest'
import type { ParticleEffectRequest } from '../src'
import { buildVehicleItem, createVehicleDestructible, engineBayVent, SMOKE_LOOKS, SmokeCause, smokePuff, smokeRate } from '../src'
import { makeKit } from './helpers/kit'

type Emitters = { kind: string; p: { x: number; y: number; z: number }; damage?: () => number }[]
type Ticking = { _: { tickEmit(c: unknown, dt: number): void } }

const sequence = (): (() => number) => {
  let state = 7
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

/** A sample car whose puffs go to a fake host effects world, like the room's. */
function routedCar() {
  const requests: ParticleEffectRequest[] = []
  const kit = makeKit({ effects: () => ({ play: (request: ParticleEffectRequest) => void requests.push(request) }) })
  const item = buildVehicleItem(kit, 'proto')
  const d = createVehicleDestructible(kit, item.vehicle, { id: 'proto_smoke', frame: item.root })
  // the item stands at the origin unturned in height: the engine's centre height is the same in the vehicle frame the emitters use
  const engineHeight = d.partWorldCenter('engine')[1]
  const tick = (seconds: number): void => {
    for (let k = 0; k < seconds * 30; k++) (kit as unknown as Ticking)._.tickEmit(d.vehicle, 1 / 30)
  }
  return { requests, d, tick, emitters: (d.vehicle as unknown as { emitters: Emitters }).emitters, engineHeight }
}

const shootEngine = (d: ReturnType<typeof routedCar>['d'], energy: number): void => {
  const e = d.partWorldCenter('engine')
  d.hit({ type: 'ballistic', point: e, direction: [0, -1, 0], energy, caliber: 12.7 })
}

describe('engine-bay smoke plume', () => {
  it('colours the puff by its cause: steam white, oil light grey, black only for a fire', () => {
    const luminance = (hex: number): number => ((hex >> 16) & 255) * 0.3 + ((hex >> 8) & 255) * 0.59 + (hex & 255) * 0.11
    expect(luminance(SMOKE_LOOKS.steam.color)).toBeGreaterThan(200)
    expect(luminance(SMOKE_LOOKS.oil.color)).toBeGreaterThan(150)
    expect(luminance(SMOKE_LOOKS.fire.color)).toBeLessThan(60)
    for (const cause of Object.values(SmokeCause)) expect(SMOKE_LOOKS[cause].alpha).toBeLessThan(0.5)
  })

  it('every puff is small and see-through at birth, rises, leans with the wind and ends several times wider', () => {
    const random = sequence()
    for (let k = 0; k < 200; k++) {
      const puff = smokePuff({ cause: SmokeCause.OIL, scale: 1, random })
      expect(puff.size).toBeLessThan(0.25)
      expect(puff.alpha).toBeLessThan(0.4)
      expect(puff.velocity[1]).toBeGreaterThan(0.5)
      expect(puff.lift).toBeGreaterThan(0)
      expect(puff.growth).toBeGreaterThanOrEqual(5)
      expect(puff.life).toBeGreaterThan(2)
      expect(puff.velocity[0]).toBeLessThan(0)
    }
  })

  it('thickens with the damage', () => {
    expect(smokeRate(4, 0.1)).toBeLessThan(smokeRate(4, 0.5))
    expect(smokeRate(4, 0.5)).toBeLessThan(smokeRate(4, 1))
    expect(smokeRate(4, 2)).toBe(smokeRate(4, 1))
  })

  it('leaves over the top of the engine and ahead of its centre, away from the windshield', () => {
    const vent = engineBayVent({ center: [1.4, 0.6, 0], size: [0.7, 0.5, 0.6] })
    expect(vent[1]).toBeGreaterThan(0.6 + 0.25)
    expect(vent[0]).toBeGreaterThan(1.4)
  })

  it('a shot engine smokes light grey out of its bay as a plume of many puffs that climb, widen and thin out', () => {
    const car = routedCar()
    shootEngine(car.d, 30000)
    const oil = car.emitters.filter((e) => e.kind === 'oil')
    expect(oil).toHaveLength(1)
    expect(car.emitters.some((e) => e.kind === 'black')).toBe(false)
    expect(oil[0]!.p.y).toBeGreaterThan(car.engineHeight + 0.2)
    car.tick(3)
    const puffs = car.requests.filter((r) => r.effect === 'particle_puff' && r.values.color === SMOKE_LOOKS.oil.color)
    expect(puffs.length).toBeGreaterThan(5)
    const xs = new Set(puffs.map((r) => r.point[0].toFixed(3)))
    expect(xs.size).toBe(puffs.length)
    for (const r of puffs) {
      expect(r.values.alpha).toBeLessThan(0.4)
      expect(r.values.size).toBeLessThan(0.25)
      expect(r.values.grow).toBeGreaterThanOrEqual(5)
      expect(r.values.gravity).toBeLessThan(0)
      expect(r.values.drag).toBeLessThan(0.9)
    }
  })

  it('a more damaged engine puts out more puffs a second', () => {
    const light = routedCar()
    shootEngine(light.d, 20000)
    const heavy = routedCar()
    shootEngine(heavy.d, 20000)
    shootEngine(heavy.d, 20000)
    shootEngine(heavy.d, 20000)
    light.tick(4)
    heavy.tick(4)
    expect(heavy.requests.length).toBeGreaterThan(light.requests.length)
  })

  it('a burning engine smokes black, from the top of the bay', () => {
    const car = routedCar()
    const e = car.d.partWorldCenter('engine')
    for (let i = 0; i < 100; i++) {
      car.d.hit({ type: 'fire', point: e, temperature: 900, radius: 0.5, duration: 0.1 })
      car.d.update!(0.1)
    }
    const black = car.emitters.filter((x) => x.kind === 'black')
    expect(black.length).toBeGreaterThan(0)
    expect(black.some((x) => x.p.y > car.engineHeight + 0.2)).toBe(true)
  })
})
