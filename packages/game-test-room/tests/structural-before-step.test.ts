import { createScheduler } from '@adatechnology/game-runtime'
import { describe, expect, it } from 'vitest'

import { registerSimulationPhases } from '../src/simulation-phases'

describe('structural events apply before the step of the tick (spec 018 D2)', () => {
  it('a body an event creates takes part in the step of the same tick', () => {
    const scheduler = createScheduler({ fixedDt: 1 / 60 })
    const bodies: string[] = []
    const stepped: string[][] = []
    let pending = true
    registerSimulationPhases(scheduler, 1 / 60, {
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
    })
    scheduler.frame(1 / 60, { render: false, exact: true })
    expect(stepped[0]).toEqual(['fragment'])
  })
})
