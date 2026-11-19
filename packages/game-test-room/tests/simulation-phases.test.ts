import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it, vi } from 'vitest'

import { MAX_TICKS_PER_FRAME, STEPS_PER_TICK, resolveSimulationTick } from '../src/simulation-phases'
import { makeRoom } from './helpers'

// Spec 010 T3.4 (C4): the room's simulation is a `fixedSimulate` system driven by the scheduler, and its physics loop steps by the tick, not by its own accumulator.
const setup = async () => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ ...KIT_WORLD })
  const loop = createPhysicsLoop(world)
  const room = makeRoom({ physics: loop })
  const order: string[] = []
  vi.spyOn(loop, 'stepFixed')
  vi.spyOn(loop, 'step')
  loop.add({ beforeStep: () => void order.push('physics-step') }, 'actors')
  room.loadModule({
    id: 'order',
    name: 'order',
    group: 'order',
    items: () => [],
    attach: (host) => {
      host.onFrame(() => order.push('input'), { phase: 'input', order: 1000 })
      host.onFrame(() => order.push('fixed-before'), { phase: 'fixedSimulate', order: 999 })
      host.onFrame(() => order.push('fixed-after'), { phase: 'fixedSimulate', order: 1001 })
      host.onFrame(() => order.push('late'), { phase: 'lateSimulate', order: -999 })
      host.onFrame(() => order.push('present'), { phase: 'present', order: 1000 })
      return () => undefined
    },
  })
  return { world, loop, room, order }
}

describe('the room simulation runs in the scheduler fixed step (spec 010 T3.4)', () => {
  it('a live frame of one tick runs input, the fixed simulation with the physics loop, the late phase and present, in that order', async () => {
    const { world, loop, room, order } = await setup()
    room.update(1 / 60, { live: true })
    expect(order).toEqual(['input', 'fixed-before', 'physics-step', 'physics-step', 'fixed-after', 'late', 'present'])
    expect(loop.stepFixed).toHaveBeenCalledExactlyOnceWith(STEPS_PER_TICK)
    expect(loop.step).not.toHaveBeenCalled()
    world.dispose()
  })

  it('a live frame of two ticks runs the fixed simulation twice before the late phase, and one of 50 ms is capped to the room limit', async () => {
    const { world, loop, room, order } = await setup()
    room.update(1 / 30, { live: true })
    expect(order.filter((phase) => phase === 'fixed-after')).toHaveLength(2)
    expect(order.indexOf('late')).toBeGreaterThan(order.lastIndexOf('fixed-after'))
    expect(loop.stepFixed).toHaveBeenCalledTimes(2)
    order.length = 0
    room.update(0.05, { live: true })
    expect(order.filter((phase) => phase === 'fixed-after').length).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME)
    world.dispose()
  })

  it('a synchronous update of one tick takes the fixed path and any other dt keeps the loop own step', async () => {
    const { world, loop, room } = await setup()
    room.update(1 / 60)
    expect(loop.stepFixed).toHaveBeenCalledTimes(1)
    expect(loop.step).not.toHaveBeenCalled()
    room.update(0.4)
    expect(loop.step).toHaveBeenCalledWith(0.4)
    expect(loop.stepFixed).toHaveBeenCalledTimes(1)
    world.dispose()
  })

  it('the tick is two physics steps and a world with another fixed step is refused at boot', () => {
    expect(resolveSimulationTick(1 / 120, 1 / 60)).toBe(1 / 60)
    expect(resolveSimulationTick(undefined, 1 / 60)).toBe(1 / 60)
    expect(() => resolveSimulationTick(1 / 60, 1 / 60)).toThrow()
  })
})
