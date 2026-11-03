// The sounds of a vehicle's cabin and body switches (the turn signal relay, the starter, the alarm, the wipers, the belt chime, the lock chirp). Like the
// library's horn, they live here until the vehicles package has a bank of its own (Q12). Synthesized; no recording.
import type { SoundBank, SoundRecipe } from '../recipe'

export const CABIN_SOUNDS: readonly SoundRecipe[] = [
  {
    id: 'blinker_tick',
    bus: 'world',
    duration: 0.03,
    layers: [
      // the relay: a click of bright noise and a short low knock
      { source: { kind: 'noise', offset: 'random' }, filters: { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 2600 } }] }, envelope: [[0, 0.22, 'set'], [0.025, 0.0001, 'exp', 'fixed']] },
      { source: { kind: 'osc', wave: 'triangle', frequency: { set: 180 } }, envelope: [[0, 0.12, 'set'], [0.03, 0.0001, 'exp', 'fixed']] },
    ],
    falloff: { model: 'none' },
  },
  {
    id: 'starter_crank',
    bus: 'world',
    duration: 0.9,
    layers: [
      // the starter motor turning the engine over: low noise chopped at the compression strokes
      {
        source: { kind: 'noise', offset: 'random' },
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 420 } }] },
        modulators: [{ target: 'gain', wave: 'square', rate: 11, depth: 0.08, base: 0.1 }],
        envelope: [[0, 0.0001, 'set', 'fixed'], [0.05, 0.25, 'linear'], [0.8, 0.22, 'set'], [0.9, 0.0001, 'exp', 'fixed']],
      },
      { source: { kind: 'osc', wave: 'sawtooth', frequency: { set: 95, to: 120, curve: 'linear', over: 0.9 } }, filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 300 } }] }, envelope: [[0, 0.04, 'set'], [0.9, 0.0001, 'exp', 'fixed']] },
    ],
    falloff: { model: 'none' },
  },
  {
    id: 'car_alarm',
    bus: 'world',
    order: 'siren',
    duration: 3,
    tail: 0.1,
    layers: [
      // the whoop of a car alarm: a square swept up and down three times a second
      {
        source: { kind: 'osc', wave: 'square', frequency: { set: 1100 } },
        modulators: [{ target: 'frequency', wave: 'triangle', rate: 3, depth: 420 }],
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 2600 } }] },
        envelope: [[0, 0.0001, 'set', 'fixed'], [0.05, 0.05, 'linear'], [2.9, 0.05, 'set'], [3, 0.0001, 'exp', 'fixed']],
      },
    ],
    falloff: { model: 'none' },
  },
  {
    id: 'alarm_chirp',
    bus: 'world',
    duration: 0.1,
    layers: [{ source: { kind: 'osc', wave: 'square', frequency: { set: 2300 } }, repeat: { count: 2, spacing: 0.16 }, envelope: [[0, 0.05, 'set'], [0.09, 0.0001, 'exp', 'fixed']] }],
    falloff: { model: 'none' },
  },
  {
    id: 'wiper_swish',
    bus: 'world',
    duration: 0.45,
    layers: [
      {
        source: { kind: 'noise', offset: 'random' },
        filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 700, to: 1100, curve: 'linear', over: 0.45 }, q: 1.2 }] },
        envelope: [[0, 0.0001, 'set', 'fixed'], [0.2, 0.06, 'linear'], [0.45, 0.0001, 'exp', 'fixed']],
      },
    ],
    falloff: { model: 'none' },
  },
  {
    id: 'seatbelt_chime',
    bus: 'world',
    duration: 0.5,
    layers: [{ source: { kind: 'osc', wave: 'sine', frequency: { set: 880 } }, repeat: { count: 3, spacing: 0.7 }, envelope: [[0, 0.06, 'set'], [0.5, 0.0001, 'exp', 'fixed']] }],
    falloff: { model: 'none' },
  },
] as unknown as readonly SoundRecipe[]

export const CABIN_BANK: SoundBank = { id: 'vehicle_cabin', sounds: CABIN_SOUNDS, loops: [] }
