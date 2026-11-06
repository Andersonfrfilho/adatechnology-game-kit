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
  {
    // the parking sensor: a short high beep, repeated by the cabin faster as the obstacle comes close
    id: 'parking_beep',
    bus: 'world',
    duration: 0.09,
    layers: [{ source: { kind: 'osc', wave: 'sine', frequency: { set: 2300 } }, envelope: [[0, 0.07, 'set'], [0.08, 0.0001, 'exp', 'fixed']] }],
    falloff: { model: 'none' },
  },
  {
    // an emergency siren's wail: a tone rising and falling slowly (one sweep about every 3 s), played again by the cabin as it ends
    id: 'siren_wail',
    bus: 'world',
    order: 'siren',
    duration: 3,
    tail: 0.05,
    layers: [
      {
        source: { kind: 'osc', wave: 'sawtooth', frequency: { set: 1050 } },
        modulators: [{ target: 'frequency', wave: 'sine', rate: 0.33, depth: 420 }],
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 2400 } }] },
        envelope: [[0, 0.0001, 'set', 'fixed'], [0.08, 0.07, 'linear'], [2.95, 0.07, 'set'], [3, 0.0001, 'exp', 'fixed']],
      },
    ],
    falloff: { model: 'none' },
  },
  {
    // the yelp: the same tone swept fast, for a junction
    id: 'siren_yelp',
    bus: 'world',
    order: 'siren',
    duration: 2,
    tail: 0.05,
    layers: [
      {
        source: { kind: 'osc', wave: 'sawtooth', frequency: { set: 1100 } },
        modulators: [{ target: 'frequency', wave: 'triangle', rate: 4, depth: 380 }],
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 2600 } }] },
        envelope: [[0, 0.0001, 'set', 'fixed'], [0.05, 0.07, 'linear'], [1.95, 0.07, 'set'], [2, 0.0001, 'exp', 'fixed']],
      },
    ],
    falloff: { model: 'none' },
  },
  {
    // the wires under the column touching: a crackle of bright noise
    id: 'hotwire_spark',
    bus: 'world',
    duration: 0.12,
    layers: [
      {
        source: { kind: 'noise', offset: 'random' },
        filters: { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 3200 } }] },
        modulators: [{ target: 'gain', wave: 'square', rate: 60, depth: 0.1, base: 0.12 }],
        envelope: [[0, 0.2, 'set'], [0.12, 0.0001, 'exp', 'fixed']],
      },
    ],
    falloff: { model: 'none' },
  },
  {
    // the glovebox latch: a small plastic click and the lid dropping
    id: 'glovebox_latch',
    bus: 'world',
    duration: 0.14,
    layers: [
      { source: { kind: 'noise', offset: 'random' }, filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 1800 }, q: 2 }] }, envelope: [[0, 0.16, 'set'], [0.03, 0.0001, 'exp', 'fixed']] },
      { source: { kind: 'osc', wave: 'triangle', frequency: { set: 240 } }, envelope: [[0, 0.0001, 'set', 'fixed'], [0.06, 0.08, 'linear'], [0.14, 0.0001, 'exp', 'fixed']] },
    ],
    falloff: { model: 'none' },
  },
] as unknown as readonly SoundRecipe[]

export const CABIN_BANK: SoundBank = { id: 'vehicle_cabin', sounds: CABIN_SOUNDS, loops: [] }
