import { describe, expect, it } from 'vitest'
import { toHostEvent } from '../src/host-events'

describe('toHostEvent', () => {
  it('turns the weapon events a module follows into host events', () => {
    expect(toHostEvent('glock_17', { type: 'shot', shots: 1, rounds: 1, mode: 'semi', at: 0 }, [1, 2])).toEqual({ type: 'shot', weapon: 'glock_17', shots: 1, recoil: [1, 2], rounds: 1, mode: 'semi' })
    expect(toHostEvent('sw_686', { type: 'misfire', at: 0 })).toEqual({ type: 'shot', weapon: 'sw_686', shots: 0, recoil: [0, 0], rounds: 1 })
    expect(toHostEvent('glock_17', { type: 'draw', phase: 'start', at: 0 })).toEqual({ type: 'tool', weapon: 'glock_17' })
    expect(toHostEvent('glock_17', { type: 'reload', phase: 'end', kind: 'tactical', at: 1 })).toEqual({ type: 'reload', weapon: 'glock_17', phase: 'end' })
    expect(toHostEvent('glock_17', { type: 'fault', fault: 'stovepipe', at: 0 })).toEqual({ type: 'fault', weapon: 'glock_17', fault: 'stovepipe' })
    expect(toHostEvent('glock_17', { type: 'clear', fault: 'stovepipe', phase: 'start', at: 0 })).toEqual({ type: 'clear', weapon: 'glock_17', fault: 'stovepipe', phase: 'start' })
    expect(toHostEvent('glock_17', { type: 'safety', on: true, at: 0 })).toEqual({ type: 'safety', weapon: 'glock_17', on: true })
    expect(toHostEvent('glock_17', { type: 'empty', at: 0 })).toEqual({ type: 'empty', weapon: 'glock_17' })
    expect(toHostEvent('glock_17', { type: 'mode', mode: 'auto', at: 0 })).toEqual({ type: 'mode', weapon: 'glock_17', mode: 'auto' })
  })

  it('keeps the finer steps inside the weapon', () => {
    expect(toHostEvent('glock_17', { type: 'cycle', phase: 'start', at: 0 })).toBeNull()
    expect(toHostEvent('glock_17', { type: 'reload_stage', stage: 'magazine_out', at: 0 })).toBeNull()
    expect(toHostEvent('glock_17', { type: 'feed', at: 0 })).toBeNull()
    expect(toHostEvent('glock_17', { type: 'draw', phase: 'end', at: 0.35 })).toBeNull()
  })
})
