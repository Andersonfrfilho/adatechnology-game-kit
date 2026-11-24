// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import type { KitWorld } from '../src/world'
import { makeWorld } from './world-helpers'

const PHASE_ORDER = ['input', 'fixedSimulate', 'lateSimulate', 'present', 'render'] as const

/** `design-host.md` §4.1, row by row, in the order the scheduler runs them (the blast pacing rows are the ones the table lists apart). */
const EXPECTED_SYSTEMS = [
  ['input', -1_000_000, 'room.blast-pacing-scripted'],
  ['input', -100000, 'room.pose-restore-input'],
  ['input', -100000, 'room.structural-mode'],
  ['fixedSimulate', -1_000_000, 'room.blast-pacing-step-start'],
  ['fixedSimulate', -100000, 'room.pose-restore'],
  ['fixedSimulate', -1000, 'room.structural-events-before-step'],
  ['fixedSimulate', 1000, 'room.simulate'],
  ['fixedSimulate', 1999, 'room.blast-pacing-begin'],
  ['fixedSimulate', 2000, 'room.structural-events'],
  ['lateSimulate', -100000, 'room.pose-restore-late'],
  ['lateSimulate', -2000, 'room.blast-pacing-slice'],
  ['lateSimulate', -1000, 'room.simulate-frame'],
  ['lateSimulate', 1000, 'room.simulate-end'],
  ['present', -1000, 'room.pose-present'],
  ['present', 10, 'room.lights'],
  ['render', -1000, 'room.lights-check'],
  ['render', 0, 'room.render'],
] as const

const inSchedulerOrder = (world: KitWorld): Array<readonly [string, number, string]> =>
  world.frame
    .systems()
    .map((system, index) => ({ ...system, index }))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase as (typeof PHASE_ORDER)[number]) - PHASE_ORDER.indexOf(b.phase as (typeof PHASE_ORDER)[number]) || a.order - b.order || a.index - b.index)
    .map((system) => [system.phase, system.order, system.id] as const)

let world: KitWorld | undefined
afterEach(() => {
  world?.dispose()
  world = undefined
})

describe('the order of the host step', () => {
  it('registers the systems, phases and orders of the table in design-host 4.1', async () => {
    world = await makeWorld()
    const stop = world.start({ render: true })
    stop()
    expect(inSchedulerOrder(world)).toEqual(EXPECTED_SYSTEMS)
  })

  it('leaves the render phase to the game when the host does not draw', async () => {
    world = await makeWorld()
    world.start({ render: false })()
    expect(world.frame.systems().filter((system) => system.phase === 'render')).toEqual([])
  })

  it('runs the systems of a scripted tick in that order', async () => {
    world = await makeWorld()
    const ran: string[] = []
    world.frame.scheduler.systemProbe = { enter: (id) => void ran.push(id), leave: () => undefined }
    world.frame.scheduler.advance(world.frame.tick)
    const ownIds = ran.filter((id) => id.startsWith('room.'))
    expect(ownIds).toEqual([
      'room.blast-pacing-scripted',
      'room.pose-restore-input',
      'room.structural-mode',
      'room.blast-pacing-step-start',
      'room.pose-restore',
      'room.structural-events-before-step',
      'room.simulate',
      'room.blast-pacing-begin',
      'room.structural-events',
      'room.pose-restore-late',
      'room.blast-pacing-slice',
      'room.simulate-frame',
      'room.simulate-end',
      'room.pose-present',
      'room.lights',
    ])
  })

  it('runs beforeWorld and afterWorld inside the one room.simulate entry, around the rules of the world', async () => {
    world = await makeWorld()
    const events: string[] = []
    world.frame.scheduler.systemProbe = {
      enter: (id) => {
        if (id === 'room.simulate') events.push('enter simulate')
      },
      leave: (id) => {
        if (id === 'room.simulate') events.push('leave simulate')
      },
    }
    world.frame.beforeWorld(() => void events.push('beforeWorld'))
    world.frame.afterWorld(() => void events.push('afterWorld'))
    world.rules.use({ fire: () => void events.push('fire'), beforePhysics: () => void events.push('beforePhysics') })
    world.frame.scheduler.advance(world.frame.tick)
    expect(events).toEqual(['enter simulate', 'beforeWorld', 'fire', 'beforePhysics', 'afterWorld', 'leave simulate'])
  })

  it('repeats the world step by `repeat` and the fire only in the first repetition', async () => {
    world = await makeWorld()
    let fires = 0
    let updates = 0
    world.rules.use({ fire: () => void fires++ })
    const fluids = world.liquids.fluids
    const update = fluids.update.bind(fluids)
    fluids.update = (dt: number) => {
      updates++
      return update(dt)
    }
    world.frame.repeat = 10
    world.frame.scheduler.advance(world.frame.tick)
    expect(fires).toBe(1)
    expect(updates).toBe(10)
  })
})
