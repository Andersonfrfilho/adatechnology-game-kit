import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'
import { createDestruction, explosivePart } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionWorld, Hit, Vec3 } from '../src'

const arsenal = createArsenal()
const explosiveDef = (id: string) => {
  const found = arsenal.explosives.get(id)
  if (!found) throw new Error(`no explosive ${id}`)
  return found
}

/** Steel drum like the game's barrel (jogo.js addExplo 68141: radius 0.3, height 0.9). */
const barrel = (id = 'fuel_barrel'): DestructibleSpec => ({
  parts: [explosivePart(explosiveDef(id), { id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0.45, 0], thickness: 0.001, fill: 0.03 })],
})

/** A box of steel standing in for a pump (Laboratório posto(): 0.8 x 1.7 x 0.55) or a tank. */
const steelBox = (id: string, size: Vec3, y: number, hp?: number): DestructibleSpec => ({
  parts: [explosivePart(explosiveDef(id), { id: 'tank', material: 'steel', shape: { kind: 'box', size }, position: [0, y, 0], thickness: 0.002, fill: 0.03, ...(hp !== undefined ? { hp } : {}) })],
})

const bulletAt = (point: Vec3): Hit => ({ type: 'ballistic', point, direction: [-1, 0, 0], energy: 3000, caliber: 7.62 })
const shotAtBarrel = (world: DestructionWorld, id: string, x: number): DestructionEvent[] => world.hit(id, bulletAt([x + 0.3, 0.45, 0])).events

const explosions = (events: readonly DestructionEvent[]) => events.filter((event): event is Extract<DestructionEvent, { type: 'explode' }> => event.type === 'explode')
const primings = (events: readonly DestructionEvent[]) => events.filter((event): event is Extract<DestructionEvent, { type: 'primed' }> => event.type === 'primed')

const run = (world: DestructionWorld, seconds: number, step: number): DestructionEvent[] => {
  const events: DestructionEvent[] = []
  for (let t = 0; t < seconds - 1e-9; t += step) events.push(...world.update(step))
  return events
}

describe('explosivePart', () => {
  it('takes the energy, the reach and the chain from the explosive (fuel_barrel: 102 kJ, injury radius 12 m)', () => {
    const def = explosiveDef('fuel_barrel')
    const part = explosivePart(def, { id: 'drum', material: 'steel', shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0, 0] })
    expect(part.explodes).toEqual({ energy: def.energy, radius: def.injuryRadius, chain: def.chain })
    expect(part.explodes?.radius).toBe(12)
  })
})

describe('chain reaction: what sets a part off (jogo.js exploDamage 68173-68190, Laboratório SC.barril)', () => {
  it('a shot primes the barrel and it goes off 1.2 s later, not before', () => {
    const world = createDestruction({ seed: 5 })
    const id = world.add(barrel())
    const hit = shotAtBarrel(world, id, 0)
    expect(primings(hit)).toMatchObject([{ trigger: 'shot', delay: 1.2, part: 'tank' }])
    expect(world.part(id, 'tank')?.status).not.toBe('broken')
    expect(explosions(run(world, 1.1, 0.1))).toHaveLength(0)
    const late = explosions(run(world, 0.2, 0.1))
    expect(late).toHaveLength(1)
    expect(late[0]?.time).toBeCloseTo(1.2, 9)
    expect(late[0]).toMatchObject({ energy: 102400, radius: 12 })
    expect(world.part(id, 'tank')?.status).toBe('broken')
  })

  it('a second shot while it waits does not prime it again or hurry it', () => {
    const world = createDestruction({ seed: 5 })
    const id = world.add(barrel())
    shotAtBarrel(world, id, 0)
    run(world, 0.5, 0.1)
    expect(primings(shotAtBarrel(world, id, 0))).toHaveLength(0)
    expect(explosions(run(world, 0.6, 0.1))).toHaveLength(0)
    expect(explosions(run(world, 0.2, 0.1))).toHaveLength(1)
  })

  it('fire primes it when the part reaches the fire temperature, and the blast follows the fire delay', () => {
    const world = createDestruction({ seed: 5 })
    const id = world.add(barrel())
    world.hit(id, { type: 'fire', point: [0, 0.45, 0], temperature: 1000, radius: 1, duration: 3 })
    const first = world.update(0.1)
    expect(primings(first)).toMatchObject([{ trigger: 'fire', delay: 1.2 }])
    expect(explosions(first)).toHaveLength(0)
    const rest = explosions(run(world, 1.3, 0.1))
    expect(rest).toHaveLength(1)
    expect(rest[0]?.time).toBeCloseTo(0.1 + 1.2, 6)
  })

  it('a blast nearby primes it with the explosion delay (0.2 to 0.4 s) instead of tearing it apart', () => {
    const world = createDestruction({ seed: 9 })
    const id = world.add(barrel(), { position: [3, 0, 0] })
    const result = world.explode([0, 0.5, 0], 200000, 12)
    const primed = primings(result.flatMap((hit) => hit.events))
    expect(primed).toHaveLength(1)
    expect(primed[0]?.trigger).toBe('explosion')
    expect(primed[0]?.delay).toBeGreaterThanOrEqual(0.2)
    expect(primed[0]?.delay).toBeLessThanOrEqual(0.4)
    expect(world.part(id, 'tank')?.status).not.toBe('broken')
    expect(explosions(run(world, 0.5, 0.05))).toHaveLength(1)
  })

  it('a car tank only goes off from shots after half of its hit points are gone (jogo.js: hp below 300 of 600)', () => {
    const world = createDestruction({ seed: 3 })
    const id = world.add(steelBox('car_fuel_tank', [0.8, 0.3, 0.5], 0.5, 600))
    const hit: Hit = { type: 'ballistic', point: [0.4, 0.5, 0], direction: [-1, 0, 0], energy: 3000, caliber: 7.62 }
    let shots = 0
    let primed = false
    while (!primed && shots < 200) {
      primed = primings(world.hit(id, hit).events).length > 0
      shots++
    }
    const part = world.part(id, 'tank')
    expect(primed).toBe(true)
    expect(shots).toBeGreaterThan(1)
    expect(1 - (part?.hp ?? 0) / (part?.maxHp ?? 1)).toBeGreaterThanOrEqual(0.5)
  })
})

describe('chain reaction: cascade', () => {
  const line = (count: number, spacing: number, seed = 11) => {
    const world = createDestruction({ seed })
    const ids = Array.from({ length: count }, (_, k) => world.add(barrel(), { id: `barrel_${k}`, position: [k * spacing, 0, 0] }))
    return { world, ids }
  }

  it('goes off in order of time, each barrel once, starting at the one that was shot, with the explosion delay for the others', () => {
    const { world, ids } = line(4, 5)
    const events = [...shotAtBarrel(world, ids[0] as string, 0), ...run(world, 10, 0.1)]
    const blasts = explosions(events)
    expect(blasts.map((blast) => blast.object).sort()).toEqual([...ids].sort())
    expect(blasts[0]?.object).toBe(ids[0])
    expect(blasts[0]?.time).toBeCloseTo(1.2, 9)
    for (let k = 1; k < blasts.length; k++) {
      const gap = (blasts[k]?.time ?? 0) - (blasts[k - 1]?.time ?? 0)
      expect(gap).toBeGreaterThanOrEqual(0)
    }
    const first = primings(events).filter((priming) => priming.trigger === 'explosion')
    for (const priming of first) {
      expect(priming.delay).toBeGreaterThanOrEqual(0.2)
      expect(priming.delay).toBeLessThanOrEqual(0.4)
    }
    expect(run(world, 5, 0.5)).toEqual([])
  })

  it('has the same timeline whatever the frame step (the delay counts from the blast, not from the frame)', () => {
    const timeline = (step: number): number[] => {
      const { world, ids } = line(5, 4, 21)
      return explosions([...shotAtBarrel(world, ids[0] as string, 0), ...run(world, 10, step)]).map((blast) => Math.round(blast.time * 1e6) / 1e6)
    }
    expect(timeline(0.01)).toEqual(timeline(0.5))
    expect(timeline(0.01)).toHaveLength(5)
  })

  it('ends: a crowd of 100 barrels each explodes exactly once and then nothing is left to do', () => {
    const { world, ids } = line(100, 1.5)
    const events = [...shotAtBarrel(world, ids[0] as string, 0), ...run(world, 60, 1)]
    const blasts = explosions(events)
    expect(blasts).toHaveLength(100)
    expect(new Set(blasts.map((blast) => blast.object)).size).toBe(100)
    expect(run(world, 10, 1)).toEqual([])
    expect(world.part(ids[99] as string, 'tank')?.status).toBe('broken')
  })

  it('is deterministic by seed: the same seed gives the same events and another seed other delays', () => {
    const events = (seed: number): string => {
      const { world, ids } = line(4, 4, seed)
      return JSON.stringify([...shotAtBarrel(world, ids[0] as string, 0), ...run(world, 10, 0.1)])
    }
    expect(events(7)).toBe(events(7))
    expect(events(7)).not.toBe(events(8))
  })

  it('survives a save in the middle of the wait: the loaded world explodes at the same moment', () => {
    const { world, ids } = line(3, 4, 5)
    shotAtBarrel(world, ids[0] as string, 0)
    run(world, 0.6, 0.1)
    const snapshot = JSON.parse(JSON.stringify(world.serialize()))
    const tail = (w: DestructionWorld) => explosions(run(w, 10, 0.1)).map((blast) => [blast.object, Math.round(blast.time * 1e6) / 1e6])
    const expected = tail(world)
    const clone = createDestruction({ seed: 5 })
    for (const entry of snapshot.objects) clone.add(entry.spec, { id: entry.id })
    clone.load(snapshot)
    expect(expected).toHaveLength(3)
    expect(tail(clone)).toEqual(expected)
  })
})

describe('chain reaction: the gas station (Laboratório SC.posto 968-995)', () => {
  it('a shot in pump 1 sets off the pumps, the car tank and the underground tank, each once, in order of time', () => {
    const world = createDestruction({ seed: 51 })
    const pumps = [-3.4, 0, 3.4].map((x, k) => world.add(steelBox('fuel_pump', [0.8, 1.7, 0.55], 0.85), { id: `pump_${k}`, position: [x, 0, 0] }))
    const car = world.add(steelBox('car_fuel_tank', [0.8, 0.3, 0.5], 0.5), { id: 'car', position: [3.4, 0, 2.6] })
    const tank = world.add(steelBox('fuel_station_tank', [4, 2, 2], 0.4), { id: 'tank', position: [-7, 0, -1] })
    const shot = world.hit(pumps[0] as string, { type: 'ballistic', point: [-3.4 + 0.4, 0.85, 0], direction: [-1, 0, 0], energy: 3000, caliber: 7.62 }).events
    expect(primings(shot)).toMatchObject([{ trigger: 'shot', delay: 1 }])
    const events = run(world, 15, 0.1)
    const blasts = explosions(events)
    expect(blasts.map((blast) => blast.object).sort()).toEqual([car, ...pumps, tank].sort())
    expect(blasts[0]).toMatchObject({ object: pumps[0], energy: 102400, radius: 12 })
    expect(blasts[0]?.time).toBeCloseTo(1, 9)
    for (let k = 1; k < blasts.length; k++) expect(blasts[k]?.time).toBeGreaterThanOrEqual(blasts[k - 1]?.time ?? 0)
    const tankBlast = blasts.find((blast) => blast.object === tank)
    expect(tankBlast?.time).toBeCloseTo(1 + 2, 6)
    expect(tankBlast).toMatchObject({ energy: explosiveDef('fuel_station_tank').energy, radius: 30 })
    const pump1 = blasts.find((blast) => blast.object === pumps[1])
    expect(pump1?.time).toBeCloseTo(1 + 0.4, 6)
  })
})

describe('chain reaction: blasts queued in one call', () => {
  it('resolves every queued blast before the call returns, however many parts went off at once', () => {
    const seen: DestructionEvent[] = []
    const world = createDestruction({ seed: 5, onEvent: (event) => seen.push(event) })
    // 100 charges without a chain delay in a 10 x 10 grid fail together under one huge blast, each queuing a blast of 30 m; a steel sheet 12 m from the middle of the grid is outside the huge blast and inside the reach of every one
    const charge: DestructibleSpec = { parts: [{ id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0.45, 0], thickness: 0.001, explodes: { energy: 102000, radius: 30 } }] }
    for (let k = 0; k < 100; k++) world.add(charge, { id: `barrel_${k}`, position: [(k % 10) * 0.7, 0, Math.floor(k / 10) * 0.7] })
    const sheet = world.add({ parts: [{ id: 'plate', material: 'steel', shape: { kind: 'box', size: [2, 2, 0.05] }, position: [0, 1, 0], anchored: true }] }, { id: 'sheet', position: [3, 0, 15] })
    const hpOf = (): number => world.part(sheet, 'plate')?.hp ?? 0
    const full = hpOf()
    world.explode([3, 0.5, 3], 1e9, 9)
    const explodedInCall = explosions(seen).length
    const afterCall = hpOf()
    expect(explodedInCall).toBeGreaterThan(64)
    expect(afterCall).toBeLessThan(full)
    world.explode([500, 0, 500], 1, 1)
    world.update(0)
    expect(explosions(seen)).toHaveLength(explodedInCall)
    expect(hpOf()).toBe(afterCall)
  })
})
