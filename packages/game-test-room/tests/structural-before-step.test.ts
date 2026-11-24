import { createScheduler } from '@adatechnology/game-runtime'
import { describe, expect, it } from 'vitest'

import { registerSimulationPhases } from '../../game-kit-defaults/src/world/simulation-phases'

describe('structural events apply in the tick: queued ones before the step, emitted ones at its end (spec 018 D2)', () => {
  it('a body an event creates takes part in the step of the same tick', () => {
    const scheduler = createScheduler({ fixedDt: 1 / 60 })
    const bodies: string[] = []
    const stepped: string[][] = []
    let pending = true
    registerSimulationPhases({ scheduler, tick: 1 / 60, hooks: {
      fixed: () => void stepped.push([...bodies]),
      frame: () => undefined,
      frameEnd: () => undefined,
      pose: { restoreStepPose: () => undefined, present: () => undefined },
      structural: {
        setStructuralInTick: () => undefined,
        applyStructuralEvents: () => {
          if (!pending) return
          pending = false
          bodies.push('fragment')
        },
      },
    } })
    scheduler.frame(1 / 60, { render: false, exact: true })
    expect(stepped[0]).toEqual(['fragment'])
  })
  it('an event the step itself emits applies at the end of that same tick, not one tick later', () => {
    const scheduler = createScheduler({ fixedDt: 1 / 60 })
    const queue: string[] = []
    const appliedAtTick: number[] = []
    let tick = 0
    registerSimulationPhases({ scheduler, tick: 1 / 60, hooks: {
      fixed: () => {
        tick++
        if (tick === 1) queue.push('hole')
      },
      frame: () => undefined,
      frameEnd: () => undefined,
      pose: { restoreStepPose: () => undefined, present: () => undefined },
      structural: {
        setStructuralInTick: () => undefined,
        applyStructuralEvents: () => {
          if (queue.length === 0) return
          queue.length = 0
          appliedAtTick.push(tick)
        },
      },
    } })
    scheduler.frame(1 / 60, { render: false, exact: true })
    expect(appliedAtTick).toEqual([1])
  })
})
