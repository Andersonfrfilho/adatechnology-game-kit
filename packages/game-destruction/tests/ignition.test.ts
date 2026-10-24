import { describe, expect, it } from 'vitest'
import { AMMO, DEFAULT_RULES, ammoIgnition } from '@adatechnology/game-weapons'
import type { Hit, Shot } from '@adatechnology/game-contracts'
import { ignitionChance, shotExtras } from '@adatechnology/game-contracts'
import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent } from '../src'

// A round that goes through a container of flammable fluid (a jerrycan, a gas bottle) makes a leak and nothing else: the leak lights when the round
// carries a spark that works on this wall or a flame (Hit.ignition, from the ammo table), by how full the container is, or when a fire or a blast
// is near. Seeds are fixed, so every count is the same on every run.
const can = (material: string): DestructibleSpec => ({
  parts: [{ id: 'can', material, shape: { kind: 'box', size: [0.4, 0.5, 0.2] }, position: [0, 0.25, 0], thickness: material === 'steel' ? 0.001 : 0.002, contains: { fluid: 'fuel', liters: 20 } }],
})

const roundOf = (id: string): Hit => {
  const def = AMMO.find((a) => a.id === id)
  if (!def) throw new Error(id)
  const energy = 0.5 * ((def.bulletGrams ?? 8) / 1000) * (def.muzzleSpeed ?? 700) ** 2
  const shot: Shot = { origin: [0, 0, 0], direction: [0, 0, -1], energy, caliber: 8, caliberId: def.caliber, speed: def.muzzleSpeed ?? 700, mass: def.bulletGrams ?? 8, energyAt: () => energy, pellet: 0, weapon: 'test' }
  shot.ignition = ammoIgnition(def, DEFAULT_RULES.ignition)
  if (def.incendiary) shot.incendiary = true
  if (def.tracer) shot.tracer = true
  return { type: 'ballistic', point: [0, 0.1, 0.1], direction: [0, 0, -1], energy, caliber: 8, ...shotExtras(shot) }
}

const lights = (events: DestructionEvent[]): boolean => events.some((e) => e.type === 'ignite' && e.part === 'can')

/** Seeded trials: one can per seed, one round into it, a second of the world after. Returns how many cans lit and whether every one leaked. */
const trials = (id: string, material: string, n: number, liters = 20): { lit: number; leaked: boolean } => {
  let lit = 0
  let leaked = true
  for (let seed = 1; seed <= n; seed++) {
    const w = createDestruction({ seed })
    const obj = w.add(can(material))
    w.setLiters(obj, 'can', liters)
    const r = w.hit(obj, roundOf(id))
    if (!r.events.some((e) => e.type === 'leak')) leaked = false
    let events = r.events
    for (let i = 0; i < 10; i++) events = events.concat(w.update(0.1))
    if (lights(events)) lit++
  }
  return { lit, leaked }
}

describe('a container of flammable fluid hit by a round', () => {
  it('leaks and does not light with ball ammunition: 100 shots of 7.62x51 M80 on a full steel can', () => {
    const { lit, leaked } = trials('7_62x51:fmj', 'steel', 100)
    expect(leaked).toBe(true)
    expect(lit).toBeLessThanOrEqual(2)
  })

  it('lights more with a steel core and jacket than with lead and copper, and more when it is nearly empty than full', () => {
    const ball = trials('7_62x51:fmj', 'steel', 300).lit
    const steel = trials('7_62x39:fmj', 'steel', 300).lit
    const ap = trials('7_62x51:ap', 'steel', 300).lit
    const lowSteel = trials('7_62x39:fmj', 'steel', 300, 2).lit
    expect(steel).toBeGreaterThan(ball)
    expect(ap).toBeGreaterThan(ball)
    expect(lowSteel).toBeGreaterThan(steel * 2)
  })

  it('sparks on steel only: a steel-core round on a plastic can does not light it, an incendiary round does', () => {
    expect(trials('7_62x39:fmj', 'plastic', 300).lit).toBe(0)
    const n = 300
    const hit = roundOf('7_62x39:incendiary')
    const expected = ignitionChance(hit, { sparkTarget: 0, fill: 1 })
    const rate = trials('7_62x39:incendiary', 'plastic', n).lit / n
    expect(Math.abs(rate - expected)).toBeLessThan(0.07)
    expect(rate).toBeGreaterThan(0.2)
  })

  it('lights with an incendiary round at the configured rate, weighed by the fill', () => {
    const n = 300
    for (const liters of [20, 2]) {
      const hit = roundOf('50bmg:incendiary')
      const expected = ignitionChance(hit, { sparkTarget: 1, fill: liters / 20 })
      const rate = trials('50bmg:incendiary', 'steel', n, liters).lit / n
      expect(Math.abs(rate - expected), `${liters} L: ${rate} against ${expected}`).toBeLessThan(0.07)
    }
  })

  it('keeps the usual sequence once lit: a petrol bottle burns as a jet, a gas bottle that explodes goes off', () => {
    const w = createDestruction({ seed: 1, ignition: { fillCurve: [[0, 1]], flameFillInfluence: 0 } })
    const obj = w.add(can('steel'))
    const hit = { ...roundOf('7_62x51:fmj'), ignition: { spark: 0, flame: 1 } }
    let events = w.hit(obj, hit).events
    for (let i = 0; i < 5; i++) events = events.concat(w.update(0.1))
    expect(lights(events)).toBe(true)
    expect(w.part(obj, 'can')?.burning).toBe(true)
    const bottle = createDestruction({ seed: 1, ignition: { fillCurve: [[0, 1]], flameFillInfluence: 0 } })
    const b = bottle.add({
      parts: [{ id: 'can', material: 'steel', shape: { kind: 'box', size: [0.4, 0.5, 0.2] }, position: [0, 0.25, 0], thickness: 0.001, explodes: { energy: 200000, radius: 6, atC: 300 }, contains: { fluid: 'fuel', liters: 20 } }],
    })
    let ev = bottle.hit(b, hit).events
    for (let i = 0; i < 5; i++) ev = ev.concat(bottle.update(0.1))
    expect(ev.some((e) => e.type === 'explode')).toBe(true)
  })

  it('lights a leak when a fire is near or a blast goes off beside it, and not one that is sound', () => {
    const wood = (): DestructibleSpec => ({ parts: [{ id: 'crate', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.4, 0.4] }, position: [0, 0.2, 0], thickness: 0.02 }] })
    const run = (leak: boolean, fireAt: number | null, blast: boolean): boolean => {
      const w = createDestruction({ seed: 3 })
      const tank = w.add(can('steel'))
      if (leak) w.hit(tank, { ...roundOf('7_62x51:fmj'), ignition: { spark: 0, flame: 0 } })
      if (fireAt !== null) {
        const crate = w.add(wood(), { position: [fireAt, 0, 0] })
        w.hit(crate, { type: 'fire', point: [fireAt, 0.2, 0], temperature: 900, radius: 0.5, duration: 5 })
        for (let i = 0; i < 20; i++) w.update(0.1)
      }
      if (blast) w.explode([1.2, 0.2, 0], 5000, 2)
      let events: DestructionEvent[] = []
      for (let i = 0; i < 40; i++) events = events.concat(w.update(0.1))
      return lights(events) || w.part(tank, 'can')?.burning === true
    }
    expect(run(true, null, false)).toBe(false)
    expect(run(true, 1.2, false)).toBe(true)
    expect(run(false, 1.2, false)).toBe(false)
    expect(run(true, null, true)).toBe(true)
    expect(run(false, null, true)).toBe(false)
    // a fire far away does nothing
    expect(run(true, 6, false)).toBe(false)
  })
})
