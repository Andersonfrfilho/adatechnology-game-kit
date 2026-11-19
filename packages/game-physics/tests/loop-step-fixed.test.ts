import { describe, expect, it } from 'vitest'

import { createPhysicsLoop } from '../src/index'
import type { PhysicsLoop, PhysicsWorld } from '../src/index'

const H = 1 / 120
const FRAMES = 600

const bitsOf = (value: number): string => {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16)
}

/** A world that is nothing but its history: the steps it was given and a number that depends on their order. */
const fakeWorld = (): PhysicsWorld & { readonly steps: number[]; state: number; cleared: number } => {
  const world = {
    fixedStep: H,
    steps: [] as number[],
    state: 0,
    cleared: 0,
    clearEvents: () => {
      world.cleared++
    },
    stepFixed: (h: number) => {
      world.steps.push(h)
      world.state = (world.state * 31 + world.steps.length) % 1_000_003
    },
  }
  return world as unknown as PhysicsWorld & { readonly steps: number[]; state: number; cleared: number }
}

const observe = (loop: PhysicsLoop): string[] => {
  const log: string[] = []
  loop.add({ beforeStep: (h, frame) => log.push(`before ${bitsOf(h)} ${frame.steps} ${bitsOf(frame.time)}`) }, 'actors')
  loop.add({ afterSteps: (dt, frame) => log.push(`after ${frame.steps} ${bitsOf(frame.time)} ${dt}`) }, 'rules')
  return log
}

const sequenceOf = (hertz: number): number[] => Array.from({ length: FRAMES }, () => 1 / hertz)

describe('PhysicsLoop.stepFixed (spec 010 T3.3)', () => {
  it.each([60, 120, 144])('at %i Hz: step(dt) and stepFixed with the steps step(dt) took give the same steps, phases and world state', (hertz) => {
    const timed = fakeWorld()
    const timedLoop = createPhysicsLoop(timed)
    const timedLog = observe(timedLoop)
    const counted = fakeWorld()
    const countedLoop = createPhysicsLoop(counted)
    const countedLog = observe(countedLoop)
    let total = 0
    for (const dt of sequenceOf(hertz)) {
      timedLoop.step(dt)
      total += timedLoop.frame.steps
      countedLoop.stepFixed(timedLoop.frame.steps)
      expect(countedLoop.frame.steps).toBe(timedLoop.frame.steps)
      expect(bitsOf(countedLoop.frame.time)).toBe(bitsOf(timedLoop.frame.time))
    }
    expect(total).toBeGreaterThan(0)
    expect(counted.steps).toEqual(timed.steps)
    expect(counted.state).toBe(timed.state)
    expect(counted.cleared).toBe(FRAMES)
    // the phases see the same steps and times; only the frame's `dt` of afterSteps differs unless the frame is a whole number of steps (below)
    const withoutDt = (line: string): string => (line.startsWith('after') ? line.split(' ').slice(0, 3).join(' ') : line)
    expect(countedLog.map(withoutDt)).toEqual(timedLog.map(withoutDt))
  })

  it('at 60 Hz the afterSteps dt is the same number too: 2 steps of 1/120 are 1/60 to the last bit', () => {
    const timedLoop = createPhysicsLoop(fakeWorld())
    const timedLog = observe(timedLoop)
    const countedLoop = createPhysicsLoop(fakeWorld())
    const countedLog = observe(countedLoop)
    for (let frame = 0; frame < FRAMES; frame++) {
      timedLoop.step(1 / 60)
      expect(timedLoop.frame.steps).toBe(2)
      countedLoop.stepFixed(2)
    }
    expect(countedLog).toEqual(timedLog)
    expect(countedLog.length).toBe(FRAMES * 3)
  })

  it('stepFixed leaves the accumulator of step(dt) alone, takes no maxDt and sets alpha to 0', () => {
    const world = fakeWorld()
    const loop = createPhysicsLoop(world, { maxDt: 0.05 })
    loop.step(H * 1.5)
    expect(loop.frame.steps).toBe(1)
    expect(loop.frame.alpha).toBeCloseTo(0.5, 9)
    loop.stepFixed(10)
    expect(loop.frame.steps).toBe(10)
    expect(loop.frame.alpha).toBe(0)
    expect(world.steps).toHaveLength(11)
    // half a step is still waiting in the accumulator
    loop.step(H * 0.5)
    expect(loop.frame.steps).toBe(1)
    loop.stepFixed(0)
    expect(loop.frame.steps).toBe(0)
    expect(world.steps).toHaveLength(12)
  })

  it('step(dt) still limits a long frame to maxDt', () => {
    const loop = createPhysicsLoop(fakeWorld(), { maxDt: 0.05 })
    loop.step(5)
    expect(loop.frame.steps).toBe(6)
  })
})
