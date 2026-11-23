// A blast begun with `beginExplosion` and run a few rays at a time is the one-shot `explode`: same events, same state, same results (spec 018 D2).
import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createDestruction, explosivePart } from '../src'
import type { BlastCharge, DestructibleSpec, DestructionEvent, DestructionWorld, HitResult, Vec3 } from '../src'

const m67 = createArsenal().explosives.get('m67')!
const GRENADE: BlastCharge = { tnt: m67.tnt!, casing: m67.casing! }
const ORIGIN: Vec3 = [0, 1, 0]
const SECOND: Vec3 = [1.5, 1, -0.5]
const SLICES = [1, 7, 32, 64, 128] as const

/** A ring of sheets of two materials around the charge, at three distances: fragments hit, pierce and ricochet; the wave breaks the near ones. */
const ringWorld = (): { world: DestructionWorld; events: string[] } => {
  const world = createDestruction({ seed: 7 })
  const events: string[] = []
  world.on('*', (event) => events.push(JSON.stringify(event)))
  for (let k = 0; k < 24; k++) {
    const angle = (k / 24) * Math.PI * 2
    const sheet: DestructibleSpec = { parts: [{ id: 'sheet', material: k % 2 ? 'steel' : 'concrete', shape: { kind: 'box', size: [0.6, 0.6, 0.05] }, position: [0, 0, 0], rotation: [0, Math.PI / 2 - angle, 0], thickness: 0.05, anchored: true }] }
    world.add(sheet, { id: `s${k}`, position: [Math.cos(angle) * (2 + (k % 3)), 1, Math.sin(angle) * (2 + (k % 3))] })
  }
  return { world, events }
}

type Outcome = { readonly events: string; readonly state: string; readonly results: string; readonly calls: number }

const outcome = (world: DestructionWorld, events: readonly string[], results: readonly HitResult[], calls: number): Outcome => ({
  events: events.join('\n'),
  state: JSON.stringify(world.serialize()),
  results: JSON.stringify(results),
  calls,
})

const oneShot = (): Outcome => {
  const { world, events } = ringWorld()
  return outcome(world, events, world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE }), 1)
}

const sliced = (rays: number): Outcome => {
  const { world, events } = ringWorld()
  const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
  expect(events).toHaveLength(0)
  let calls = 0
  while (!job.isDone) {
    calls++
    job.advance(rays)
  }
  return outcome(world, events, job.result(), calls)
}

describe('beginExplosion', () => {
  it('gives the bytes of the one-shot explode (events, serialize, results) for K = 1, 7, 32, 64 and 128 rays per call', () => {
    const whole = oneShot()
    expect(whole.events.length).toBeGreaterThan(0)
    // one ray per call: the rays the case casts here, plus the wave in a call of its own
    const rays = sliced(1).calls - 1
    expect(rays).toBeGreaterThan(64)
    for (const perCall of SLICES) {
      const cut = sliced(perCall)
      expect(cut.calls).toBe(Math.ceil(rays / perCall) + 1)
      expect(cut.events).toBe(whole.events)
      expect(cut.state).toBe(whole.state)
      expect(cut.results).toBe(whole.results)
    }
  })

  it.each([
    ['plain (no shelter, fragment hits or confinement)', { charge: GRENADE }],
    ['through the scene (shelter, fragment hits, confinement)', { charge: GRENADE, shelter: true, fragmentHits: true, confinement: true }],
  ] as const)('with the wave %s cut by parts too: the bytes of explode for 1, 3 and 16 parts per call', (_name, blast) => {
    const reference = ringWorld()
    const whole = outcome(reference.world, reference.events, reference.world.explode(ORIGIN, m67.energy, 15, 'test', blast), 1)
    for (const [rays, parts] of [[64, 1], [7, 3], [128, 16]] as const) {
      const { world, events } = ringWorld()
      const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'test', blast)
      let calls = 0
      while (!job.advance(rays, parts)) calls++
      // one part per call: a call per part the wave reaches, past the rays' calls
      if (parts === 1) expect(calls).toBeGreaterThan(10)
      expect(outcome(world, events, job.result(), 1)).toEqual(whole)
    }
  })

  it('emits between the calls only what the rays cast so far did, and the wave never in a call that cast rays', () => {
    const { world, events } = ringWorld()
    const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
    const counts: number[] = []
    while (!job.advance(32)) counts.push(events.length)
    expect(counts.length).toBeGreaterThan(2)
    expect(counts[counts.length - 1]).toBeLessThan(events.length)
    expect(() => world.beginExplosion(ORIGIN, 0, 1).result()).toThrow()
  })

  it('queues a blast begun while another is open: it runs after the first ends, never inside it, and both give the bytes of two explodes in a row', () => {
    const inRow = ringWorld()
    const first = inRow.world.explode(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    const firstEvents = inRow.events.length
    const second = inRow.world.explode(SECOND, m67.energy, 15, 'b', { charge: GRENADE })
    const expected = outcome(inRow.world, inRow.events, [...first, ...second], 2)

    const queued = ringWorld()
    const jobA = queued.world.beginExplosion(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    jobA.advance(32)
    const jobB = queued.world.beginExplosion(SECOND, m67.energy, 15, 'b', { charge: GRENADE })
    // begun, the second runs nothing; advancing it runs the first to its end before a ray of its own
    expect(jobB.isDone).toBe(false)
    const eventsOfFirstSoFar = queued.events.length
    jobB.advance(1)
    expect(jobA.isDone).toBe(true)
    expect(jobB.isDone).toBe(false)
    expect(eventsOfFirstSoFar).toBeLessThan(firstEvents)
    expect(queued.events.slice(0, firstEvents)).toEqual(inRow.events.slice(0, firstEvents))
    while (!jobB.advance(32));
    expect(outcome(queued.world, queued.events, [...jobA.result(), ...jobB.result()], 2)).toEqual(expected)
  })

  it('runs every open blast to its end before any other operation (update, shoot): the bytes of explode then that operation', () => {
    const inRow = ringWorld()
    const results = inRow.world.explode(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    inRow.world.update(1 / 60)
    inRow.world.shoot([0, 1, 4], [0, 0, -1], 2000, 7.62, 'shot')
    const expected = outcome(inRow.world, inRow.events, results, 1)

    const open = ringWorld()
    const job = open.world.beginExplosion(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    job.advance(64)
    open.world.update(1 / 60)
    expect(job.isDone).toBe(true)
    open.world.shoot([0, 1, 4], [0, 0, -1], 2000, 7.62, 'shot')
    expect(outcome(open.world, open.events, job.result(), 1)).toEqual(expected)
  })

  it('a step that throws ends its explosion: isDone, result() throws it again, advance never touches another job, and the next blast runs', () => {
    const { world, events } = ringWorld()
    let isArmed = true
    world.on('*', () => {
      if (!isArmed) return
      isArmed = false
      throw new Error('listener failed')
    })
    const broken = world.beginExplosion(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    const next = world.beginExplosion(SECOND, m67.energy, 15, 'b', { charge: GRENADE })
    expect(() => broken.advance(64)).toThrow('listener failed')
    expect(broken.isDone).toBe(true)
    expect(() => broken.result()).toThrow('listener failed')
    // the dropped job does not advance the one behind it
    const before = events.length
    expect(broken.advance(64)).toBe(true)
    expect(events.length).toBe(before)
    while (!next.advance(64));
    expect(next.result().length).toBeGreaterThan(0)
  })

  it('serialize runs an open explosion to its end first (never a half-applied state) and counts it in explosionProbe', () => {
    const reference = ringWorld()
    reference.world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
    const { world } = ringWorld()
    const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
    job.advance(32)
    expect(world.explosionProbe().finishedByOperation).toBe(0)
    expect(JSON.stringify(world.serialize())).toBe(JSON.stringify(reference.world.serialize()))
    expect(job.isDone).toBe(true)
    expect(world.explosionProbe().finishedByOperation).toBe(1)
  })

  it('cancelExplosions drops an open blast where it stands: the next operation does not run it on, and its result() throws', () => {
    const { world, events } = ringWorld()
    const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'a', { charge: GRENADE })
    job.advance(32)
    world.cancelExplosions()
    const before = events.length
    world.update(1 / 60)
    expect(events.slice(before).some((event) => event.includes('"source":"a"') && event.includes('"type":"blast"'))).toBe(false)
    expect(job.isDone).toBe(true)
    expect(() => job.result()).toThrow('cancelled')
    expect(world.explosionProbe().finishedByOperation).toBe(0)
  })

  it('cancelExplosions also drops the blasts its fragments set off: after a load, the next update sets off nothing of the cancelled blast', () => {
    const world = createDestruction({ seed: 7 })
    const fuel = createArsenal().explosives.get('gas_cylinder') ?? createArsenal().explosives.get('fuel_barrel')!
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2
      const can: DestructibleSpec = { parts: [explosivePart(fuel, { id: 'tank', material: 'steel', shape: { kind: 'box', size: [0.3, 0.5, 0.3] }, position: [0, 0, 0], thickness: 0.001, fill: 0.03, hp: 1 })] }
      world.add(can, { id: `c${k}`, position: [Math.cos(angle) * 0.7, 1, Math.sin(angle) * 0.7] })
    }
    const pristine = world.serialize()
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    const job = world.beginExplosion(ORIGIN, m67.energy, 15, 'cancelled', { charge: GRENADE })
    // rays until one of them breaks a can (its blast waits for the end of the operation)
    for (let ray = 0; ray < 400 && !events.some((event) => event.type === 'explode'); ray++) job.advance(1)
    expect(events.some((event) => event.type === 'explode')).toBe(true)
    expect(job.isDone).toBe(false)
    world.load(pristine)
    const before = events.length
    world.update(1 / 60)
    expect(events.slice(before).filter((event) => event.source === 'cancelled')).toEqual([])
  })
})
