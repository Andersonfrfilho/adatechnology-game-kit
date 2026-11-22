// SPIKE D2 (spec 018, throwaway): a blast run in slices of K rays, with nothing else touching the world between them, is the unsliced blast (same events, same state).
import { createArsenal } from '@adatechnology/game-weapons'
import { afterEach, describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { BlastCharge, DestructibleSpec, DestructionEvent } from '../src'
import type { D2Probe } from '../src/world'

const m67 = createArsenal().explosives.get('m67')!
const GRENADE: BlastCharge = { tnt: m67.tnt!, casing: m67.casing! }
const ORIGIN: [number, number, number] = [0, 1, 0]

const probeHost = globalThis as { __d2?: D2Probe }
const freshProbe = (raysPerSlice?: number): D2Probe => ({ ...(raysPerSlice === undefined ? {} : { raysPerSlice }), isTiming: true, phase: 'other', eventsByPhase: {}, rayMs: [], rayEvents: [], setupMs: 0, fragMs: 0, waveMs: 0, raysCast: 0, done: false, pending: false })

const run = (raysPerSlice: number | undefined) => {
  probeHost.__d2 = freshProbe(raysPerSlice)
  const world = createDestruction({ seed: 7 })
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  for (let k = 0; k < 24; k++) {
    const angle = (k / 24) * Math.PI * 2
    const sheet: DestructibleSpec = { parts: [{ id: 'sheet', material: k % 2 ? 'steel' : 'concrete', shape: { kind: 'box', size: [0.6, 0.6, 0.05] }, position: [0, 0, 0], rotation: [0, Math.PI / 2 - angle, 0], thickness: 0.05, anchored: true }] }
    world.add(sheet, { id: `s${k}`, position: [Math.cos(angle) * (2 + (k % 3)), 1, Math.sin(angle) * (2 + (k % 3))] })
  }
  const spike = probeHost.__d2
  const returned = world.explode(ORIGIN, m67.energy, 15, 'test', { charge: GRENADE })
  let slices = 1
  if (raysPerSlice !== undefined) {
    expect(returned).toEqual([])
    while (spike.advance) {
      slices++
      if (spike.advance(raysPerSlice)) break
    }
  }
  const results = raysPerSlice === undefined ? returned : (spike.results as typeof returned)
  return { events: JSON.stringify(events), state: JSON.stringify(world.serialize()), results: JSON.stringify(results), slices, raysCast: spike.raysCast }
}

describe('D2 spike: the sliced blast', () => {
  afterEach(() => {
    delete probeHost.__d2
  })

  it('gives the bytes of the whole blast for K in 1, 7, 32, 64, 128 (nothing runs between the slices)', () => {
    const whole = run(undefined)
    expect(whole.raysCast).toBeGreaterThan(0)
    for (const k of [1, 7, 32, 64, 128]) {
      const sliced = run(k)
      expect(sliced.slices).toBeGreaterThan(1)
      expect(sliced.events).toBe(whole.events)
      expect(sliced.state).toBe(whole.state)
      expect(sliced.results).toBe(whole.results)
    }
  })
})
