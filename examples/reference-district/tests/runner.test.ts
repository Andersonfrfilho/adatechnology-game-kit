import { describe, expect, it } from 'vitest'

import { pathAt, runScript } from '../src/test/runner'
import type { ActionResult, PhaseEdge, ScriptWorld } from '../src/test/runner'
import type { Script, ScriptEvent } from '../src/test/scripts'
import { scripts } from './helpers'

const TICK = 1 / 60
const settings = { zombies: 100, weather: 'overcast', timeOfDay: 'day' } as const

type Log = { world: ScriptWorld; log: string[]; steps: () => number }

/** A world that only writes down what it is told, one line each, with the tick it was told at. */
function fakeWorld(answer: (event: ScriptEvent) => ActionResult = () => ({ status: 'done' })): Log {
  const log: string[] = []
  let steps = 0
  const world: ScriptWorld = {
    tick: TICK,
    step: () => void steps++,
    placePlayer: (spot) => void (steps % 60 === 0 && log.push(`${steps}:player ${spot.x.toFixed(1)},${spot.z.toFixed(1)}`)),
    setCamera: (mode) => (log.push(`${steps}:camera ${mode}`), mode === 'vehicle' ? { status: 'pending', limit: 'L7', reason: 'no driver' } : { status: 'done' }),
    act: (event, context) => (log.push(`${steps}:${event.kind}:${context.zombies}`), answer(event)),
    hash: () => ({ steps }),
  }
  return { world, log, steps: () => steps }
}

const script: Script = {
  id: 'street',
  scenarios: ['tipico'],
  seed: 1,
  camera: [{ at: 0, mode: 'shoulder' }, { at: 2, mode: 'first' }, { at: 3, mode: 'vehicle' }],
  path: [{ at: 0, x: 0, z: 0 }, { at: 2, x: 10, z: 0 }],
  phases: [{ id: 'load', from: -1, to: 0 }, { id: 'a', from: 0, to: 2 }, { id: 'b', from: 2, to: 4 }],
  events: [
    { at: 3, kind: 'door', door: 'x', open: true },
    { at: 1, kind: 'horde_release', zone: 'z', share: 0.5 },
    { at: 1, kind: 'fire_line', points: [[0, 0], [1, 1]], pending: 'L15' },
    { at: 2, kind: 'throw', explosive: 'm67', to: [1, 1] },
  ],
}

describe('runScript', () => {
  it('runs the events at their world time in order, ties in file order', () => {
    const { world, log } = fakeWorld()
    const run = runScript(world, script, settings)
    expect(log.filter((line) => line.includes(':horde') || line.includes(':throw') || line.includes(':door'))).toEqual(['60:horde_release:100', '120:throw:100', '180:door:100'])
    expect(run.events.map((event) => [event.index, event.tick])).toEqual([[1, 60], [2, 60], [3, 120], [0, 180]])
    expect(run.ticks).toBe(240)
  })

  it('hashes each phase when its time is reached, before the events of that same time', () => {
    const { world } = fakeWorld()
    const run = runScript(world, script, settings)
    expect(run.phases.map((phase) => [phase.id, phase.endTick, phase.hash])).toEqual([['load', 0, { steps: 0 }], ['a', 120, { steps: 120 }], ['b', 240, { steps: 240 }]])
  })

  it('calls the phase edges in order and skips the pending events of the script without running them', () => {
    const edges: string[] = []
    const { world, log } = fakeWorld()
    const run = runScript(world, script, settings, { onPhase: (edge: PhaseEdge) => edges.push(`${edge.edge}:${edge.id}@${edge.time.toFixed(2)}`) })
    expect(edges).toEqual(['start:load@0.00', 'end:load@0.00', 'start:a@0.00', 'end:a@2.00', 'start:b@2.00', 'end:b@4.00'])
    expect(log.some((line) => line.includes('fire_line'))).toBe(false)
    expect(run.events.find((event) => event.kind === 'fire_line')).toMatchObject({ status: 'pending', limit: 'L15', source: 'script' })
  })

  it('records what the world answers pending, and the cues it could not take', () => {
    const { world } = fakeWorld((event) => (event.kind === 'door' ? { status: 'pending', limit: 'L6', reason: 'no hand' } : { status: 'done' }))
    const run = runScript(world, script, settings)
    expect(run.events.find((event) => event.kind === 'door')).toMatchObject({ status: 'pending', limit: 'L6', source: 'world' })
    expect(run.cues).toEqual([{ at: 0, mode: 'shoulder', status: 'done' }, { at: 2, mode: 'first', status: 'done' }, { at: 3, mode: 'vehicle', status: 'pending', limit: 'L7' }])
  })

  it('gives the same records for the same script and world', () => {
    expect(runScript(fakeWorld().world, script, settings)).toEqual(runScript(fakeWorld().world, script, settings))
  })

  it('refuses an event after the last phase', () => {
    expect(() => runScript(fakeWorld().world, { ...script, events: [{ at: 9, kind: 'door', door: 'x', open: true }] }, settings)).toThrow(/after its last phase/)
  })

  it('runs both scripts of the data file to the end of their last phase', () => {
    for (const real of scripts.scripts) {
      const run = runScript(fakeWorld().world, real, settings)
      expect(run.phases.map((phase) => phase.id)).toEqual(real.phases.map((phase) => phase.id))
      expect(run.events).toHaveLength(real.events.length)
      expect(run.events.filter((event) => event.source === 'script').map((event) => event.limit)).toEqual(real.events.flatMap((event) => (event.pending ? [event.pending] : [])))
    }
  })
})

describe('pathAt', () => {
  it('joins the points with straight lines and holds the ends', () => {
    expect(pathAt(script.path, -1)).toMatchObject({ x: 0 })
    expect(pathAt(script.path, 1)).toEqual({ x: 5, z: 0, vx: 5, vz: 0 })
    expect(pathAt(script.path, 9)).toMatchObject({ x: 10, vx: 0 })
  })
})
