import type { Computed, EffectStep, ScreenKey } from './types'

type System = 'add' | 'normal' | 'streak'

/** Constructors for the steps of a recipe (they only build data). */
export const burst = (system: System, count: Computed, spawn: Computed): EffectStep => ({ op: 'burst', system, count, spawn })
export const spawn = (system: System, options: Computed): EffectStep => ({ op: 'spawn', system, spawn: options })
export const emit = (key: string, system: System, rate: Computed, options: Computed): EffectStep => ({ op: 'emit', key, system, rate, spawn: options })
export const debris = (options: Computed): EffectStep => ({ op: 'debris', spawn: options })
export const decal = (...args: readonly Computed[]): EffectStep => ({ op: 'decal', args })
export const ring = (...args: readonly Computed[]): EffectStep => ({ op: 'ring', args })
export const flash = (...args: readonly Computed[]): EffectStep => ({ op: 'flash', args })
export const lens = (...args: readonly Computed[]): EffectStep => ({ op: 'lens', args })
export const screen = (change: { add?: Partial<Record<ScreenKey, Computed>>; set?: Partial<Record<ScreenKey, Computed>>; max?: Partial<Record<ScreenKey, Computed>> }): EffectStep => ({ op: 'screen', ...change })
export const fireLight = (slot: 0 | 1, point: Computed, intensity: Computed, time: Computed): EffectStep => ({ op: 'fire_light', slot, point, intensity, time })
export const fireLightOff = (slot: 0 | 1): EffectStep => ({ op: 'fire_light_off', slot })
export const cue = (name: string, args?: Computed, draws?: number): EffectStep => ({ op: 'cue', cue: name, ...(args !== undefined ? { args } : {}), ...(draws !== undefined ? { draws } : {}) })
export const call = (macro: string, ...args: readonly Computed[]): EffectStep => ({ op: 'call', macro, args })
export const after = (time: Computed, ...steps: readonly EffectStep[]): EffectStep => ({ op: 'at', time, steps })
export const when = (condition: Computed, steps: readonly EffectStep[], otherwise?: readonly EffectStep[]): EffectStep => ({ op: 'when', if: condition, steps, ...(otherwise ? { otherwise } : {}) })
export const repeat = (count: Computed, ...steps: readonly EffectStep[]): EffectStep => ({ op: 'repeat', count, steps })
export const set = (name: string, value: Computed): EffectStep => ({ op: 'set', name, value })
export const behavior = (id: string, action: string, args?: Computed): EffectStep => ({ op: 'behavior', id, action, ...(args !== undefined ? { args } : {}) })
export const append = (name: string, value: Computed): EffectStep => ({ op: 'append', name, value })
export const camera = (eye: Computed, target: Computed, instant?: boolean): EffectStep => ({ op: 'camera', eye, target, ...(instant ? { instant } : {}) })
export const post = (values: Readonly<Record<string, Computed>>): EffectStep => ({ op: 'post', values })
