import { describe, expect, it } from 'vitest'
import { toHostEvent } from '../src/host-events'

describe('toHostEvent', () => {
  it('turns the weapon events a module follows into host events', () => {
    expect(toHostEvent('glock_17', { type: 'shot', shots: 1, rounds: 1, mode: 'semi', at: 0 }, { recoil: [1, 2] })).toEqual({ type: 'shot', weapon: 'glock_17', shots: 1, recoil: [1, 2], rounds: 1, mode: 'semi' })
    expect(toHostEvent('sw_686', { type: 'misfire', at: 0 })).toEqual({ type: 'misfire', weapon: 'sw_686' })
    expect(toHostEvent('glock_17', { type: 'draw', phase: 'start', at: 0 })).toEqual({ type: 'tool', weapon: 'glock_17' })
    expect(toHostEvent('glock_17', { type: 'reload', phase: 'end', kind: 'tactical', at: 1 })).toEqual({ type: 'reload', weapon: 'glock_17', phase: 'end' })
    expect(toHostEvent('glock_17', { type: 'fault', fault: 'stovepipe', at: 0 })).toEqual({ type: 'fault', weapon: 'glock_17', fault: 'stovepipe' })
    expect(toHostEvent('glock_17', { type: 'clear', fault: 'stovepipe', phase: 'start', at: 0 })).toEqual({ type: 'clear', weapon: 'glock_17', fault: 'stovepipe', phase: 'start' })
    expect(toHostEvent('glock_17', { type: 'safety', on: true, at: 0 })).toEqual({ type: 'safety', weapon: 'glock_17', on: true })
    expect(toHostEvent('glock_17', { type: 'empty', at: 0 })).toEqual({ type: 'empty', weapon: 'glock_17' })
    expect(toHostEvent('colt_m4a1', { type: 'attachment', action: 'fit', id: 'suppressor', mount: 'muzzle', at: 0 }, { phase: { id: 'fit', start: 0, end: 15 } })).toEqual({ type: 'attachment', weapon: 'colt_m4a1', action: 'fit', attachment: 'suppressor', mount: 'muzzle', duration: 15 })
    expect(toHostEvent('colt_m4a1', { type: 'attachment', action: 'break', id: 'oil_filter_suppressor', mount: 'muzzle', at: 0 })).toEqual({ type: 'attachment', weapon: 'colt_m4a1', action: 'break', attachment: 'oil_filter_suppressor', mount: 'muzzle' })
    expect(toHostEvent('colt_m4a1', { type: 'toggle', id: 'weapon_light', on: true, at: 0 })).toEqual({ type: 'toggle', weapon: 'colt_m4a1', attachment: 'weapon_light', on: true })
    expect(toHostEvent('colt_m4a1', { type: 'stock', state: 'collapsed', kind: 'retract', at: 0 }, { phase: { id: 'stock', start: 0, end: 0.6 } })).toEqual({ type: 'stock', weapon: 'colt_m4a1', state: 'collapsed', kind: 'retract', duration: 0.6 })
    expect(toHostEvent('colt_m4a1', { type: 'underbarrel', on: true, at: 0 })).toEqual({ type: 'underbarrel', weapon: 'colt_m4a1', on: true })
    expect(toHostEvent('glock_17', { type: 'mode', mode: 'auto', at: 0 })).toEqual({ type: 'mode', weapon: 'glock_17', mode: 'auto' })
  })

  it('carries the kind and the seconds of a phase the rule started, and the finer steps of the cycle', () => {
    const phase = (id: 'draw' | 'cycle' | 'reload' | 'clear', start: number, end: number) => ({ id, start, end })
    expect(toHostEvent('glock_17', { type: 'draw', phase: 'start', at: 0 }, { phase: phase('draw', 0, 0.35) })).toEqual({ type: 'tool', weapon: 'glock_17', duration: 0.35 })
    expect(toHostEvent('glock_17', { type: 'reload', phase: 'start', kind: 'empty', at: 1 }, { phase: phase('reload', 1, 3.5) })).toEqual({ type: 'reload', weapon: 'glock_17', phase: 'start', kind: 'empty', duration: 2.5 })
    expect(toHostEvent('glock_17', { type: 'cycle', phase: 'start', at: 0 }, { phase: phase('cycle', 0, 0.5) })).toEqual({ type: 'cycle', weapon: 'glock_17', phase: 'start', duration: 0.5 })
    expect(toHostEvent('glock_17', { type: 'cycle', phase: 'end', at: 0.5 })).toEqual({ type: 'cycle', weapon: 'glock_17', phase: 'end' })
    expect(toHostEvent('glock_17', { type: 'reload_stage', stage: 'magazine_out', at: 0 })).toEqual({ type: 'stage', weapon: 'glock_17', stage: 'magazine_out' })
    expect(toHostEvent('glock_17', { type: 'feed', at: 0 })).toEqual({ type: 'feed', weapon: 'glock_17' })
  })

  it('leaves out the duration when the weapon is busy with something else, and the end of a draw', () => {
    expect(toHostEvent('glock_17', { type: 'clear', fault: 'stovepipe', phase: 'start', at: 0 }, { phase: { id: 'reload', start: 0, end: 2 } })).toEqual({ type: 'clear', weapon: 'glock_17', fault: 'stovepipe', phase: 'start' })
    expect(toHostEvent('glock_17', { type: 'draw', phase: 'end', at: 0.35 })).toBeNull()
  })
})

describe('toHostEvent: launchers', () => {
  it('a launcher spends a round and throws one projectile, which the weapon counts as none: the host hears one', () => {
    expect(toHostEvent('rpg_7', { type: 'shot', shots: 0, rounds: 1, mode: 'single', at: 0 })).toMatchObject({ type: 'shot', shots: 1, rounds: 1 })
  })
})
