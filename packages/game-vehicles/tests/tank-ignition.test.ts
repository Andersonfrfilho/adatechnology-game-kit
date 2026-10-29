import { describe, expect, it } from 'vitest'
import { ignitionChance, type DestructionEvent, type Hit } from '@adatechnology/game-contracts'
import { AMMO, DEFAULT_RULES, ammoIgnition } from '@adatechnology/game-weapons'
import { buildVehicleItem, createVehicleDestructible, type VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'

// A normal bullet that goes through a fuel tank leaks and does not blow it up by itself. What lights the leak is a spark of a hard round on steel,
// an incendiary or tracer round, a fire near or a blast; the chances come from the round (`Hit.ignition`, from the ammo table of the weapons) and from
// how full the tank is. The seeds are fixed, so the counts below are the same on every run.
const kit = makeKit()

// The loops of 100 and 300 shots share one built vehicle (building one takes longer than a hundred shots); a destructible only keeps its own state
// (the seed is what changes), and the tests that play a fire to the end take a vehicle of their own.
const shared = buildVehicleItem(kit, 'proto')
const make = (seed: number, options: { fuel?: number; own?: boolean } = {}): VehicleDestructible => {
  const built = options.own ? buildVehicleItem(kit, 'proto') : shared
  return createVehicleDestructible(kit, built.vehicle, { id: `proto_${seed}`, frame: built.root, headless: true, seed, ...(options.fuel === undefined ? {} : { fuel: options.fuel }) })
}

const round = (id: string): Pick<Hit, 'ignition' | 'incendiary' | 'tracer' | 'energy' | 'caliber'> => {
  const def = AMMO.find((a) => a.id === id)
  if (!def) throw new Error(id)
  const load = 0.5 * ((def.bulletGrams ?? 0) / 1000) * (def.muzzleSpeed ?? 0) ** 2
  return { ignition: ammoIgnition(def, DEFAULT_RULES.ignition), ...(def.incendiary ? { incendiary: true } : {}), ...(def.tracer ? { tracer: true } : {}), energy: load > 0 ? load : 3000, caliber: 8 }
}

/** One round through the low side of the tank; returns the events of the shot and of the next second. */
const shoot = (d: VehicleDestructible, r: Pick<Hit, 'ignition' | 'incendiary' | 'tracer' | 'energy' | 'caliber'>): DestructionEvent[] => {
  const t = d.partWorldCenter('fuel_tank')
  const spec = d.describe().parts.find((p) => p.id === 'fuel_tank')!
  const low = t[1] - (spec.shape.kind === 'box' ? spec.shape.size[1] / 2 - 0.02 : 0)
  let evs = d.hit({ type: 'ballistic', point: [t[0], low, t[2]], direction: [0, 0, -1], ...r })
  for (let i = 0; i < 10; i++) evs = evs.concat(d.update!(0.1))
  return evs
}
const lit = (evs: DestructionEvent[]): boolean => evs.some((e) => e.type === 'ignite' && (e as { part?: string }).part === 'fuel_tank')

/** How many of `n` seeded shots of the round light a tank filled to `fuel`; every one of them must leak or hole the tank. */
const fires = (id: string, n = 100, fuel = 1): number => {
  let count = 0
  for (let seed = 1; seed <= n; seed++) {
    const evs = shoot(make(seed, { fuel }), round(id))
    expect(evs.some((e) => e.type === 'hole')).toBe(true)
    if (lit(evs)) count++
  }
  return count
}

describe('a fuel tank hit by a bullet', () => {
  it('leaks and does not light with ball ammunition: 100 shots of 7.62x51 M80 on a full tank', () => {
    const evs = shoot(make(1), round('7_62x51:fmj'))
    expect(evs.filter((e) => e.type === 'leak')).toHaveLength(1)
    expect(fires('7_62x51:fmj')).toBeLessThanOrEqual(2)
  })

  it('lights more with a steel core, a steel jacket and an armour-piercing core than with lead and copper', () => {
    const ball = fires('7_62x51:fmj', 300)
    const steel = fires('7_62x39:fmj', 300)
    const steel545 = fires('5_45x39:fmj', 300)
    const ap = fires('7_62x51:ap', 300)
    expect(steel).toBeGreaterThan(ball)
    expect(steel545).toBeGreaterThan(ball)
    expect(ap).toBeGreaterThan(ball)
    // still rare against a full tank: the spark is not a flame
    expect(steel).toBeLessThan(60)
  })

  it('lights more when it is nearly empty than when it is full, with the same round', () => {
    const full = fires('7_62x39:fmj', 300, 1)
    const low = fires('7_62x39:fmj', 300, 0.1)
    expect(low).toBeGreaterThan(full * 2)
  })

  it('lights with an incendiary round at the configured rate, more when the tank is low, and with a tracer more than with ball', () => {
    const n = 500
    const r = round('50bmg:incendiary')
    for (const fuel of [1, 0.1]) {
      // the rate is the configured flame of the round weighed by the fill (`ignitionChance`), within the spread of 500 seeded shots
      const expected = ignitionChance(r, { sparkTarget: 1, fill: fuel })
      const rate = fires('50bmg:incendiary', n, fuel) / n
      expect(Math.abs(rate - expected), `fill ${fuel}: ${rate} against ${expected}`).toBeLessThan(0.07)
    }
    expect(ignitionChance(r, { sparkTarget: 1, fill: 1 })).toBeLessThan(DEFAULT_RULES.ignition.flame.incendiary)
    expect(fires('7_62x51:tracer', n, 1)).toBeGreaterThan(fires('7_62x51:fmj', n, 1))
  })

  it('keeps the whole sequence once it is lit: fire, then the explosion of a petrol tank', () => {
    // a tank with a little fuel in it, where the flame of the round always reaches the vapour
    const d = make(1, { fuel: 0.1, own: true })
    const r = { ...round('50bmg:incendiary'), ignition: { spark: 0, flame: 1 } }
    let evs = shoot(d, r)
    for (let i = 0; i < 600 && !evs.some((e) => e.type === 'explode'); i++) evs = evs.concat(d.update!(0.1))
    expect(lit(evs)).toBe(true)
    expect(evs.some((e) => e.type === 'explode')).toBe(true)
  })

  it('does not light a plain leak by itself, but lights it soon when a burning part is near', () => {
    // the rear tyre, a metre from the tank, catches fire; the tank is pierced by a plain bullet in one car and sound in the other
    const burn = (seed: number, leak: boolean): { tyre: number; tank: number } => {
      const d = make(seed, { own: true })
      const tyre = d.partWorldCenter('tyre_rear_right')
      if (leak) d.hit({ type: 'ballistic', ...bottomOfTank(d), energy: 3000, caliber: 8 })
      const at = { tyre: -1, tank: -1 }
      for (let i = 0; i < 100 && at.tank < 0; i++) {
        const evs = (at.tyre < 0 ? d.hit({ type: 'fire', point: tyre, temperature: 900, radius: 0.3, duration: 0.1 }) : []).concat(d.update!(0.1))
        for (const e of evs) {
          if (e.type !== 'ignite') continue
          const part = (e as { part?: string }).part
          if (part === 'tyre_rear_right' && at.tyre < 0) at.tyre = i / 10
          if (part === 'fuel_tank') at.tank = i / 10
        }
      }
      return at
    }
    for (const seed of [1, 2, 3]) {
      const leaking = burn(seed, true)
      const sound = burn(seed, false)
      expect(leaking.tyre).toBeGreaterThanOrEqual(0)
      expect(leaking.tank).toBeGreaterThan(leaking.tyre)
      expect(leaking.tank - leaking.tyre).toBeLessThan(4)
      // the sound tank is only heated by the flames, much later
      expect(sound.tank < 0 || sound.tank - sound.tyre > 8).toBe(true)
    }
  })
})

const bottomOfTank = (d: VehicleDestructible): Pick<Hit, 'point' | 'direction'> => {
  const t = d.partWorldCenter('fuel_tank')
  const spec = d.describe().parts.find((p) => p.id === 'fuel_tank')!
  const low = t[1] - (spec.shape.kind === 'box' ? spec.shape.size[1] / 2 - 0.02 : 0)
  return { point: [t[0], low, t[2]], direction: [0, 0, -1] }
}
