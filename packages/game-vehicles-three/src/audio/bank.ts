// The vehicle sounds as recipes of @adatechnology/game-audio, made by the kit (no team delivered vehicle sounds beyond the game's saw, horn and crash):
// engines as loops crossfaded by RPM, the starter, tyres, crashes by speed and the doors, hood and trunk of a car. The ids follow the sound list
// (`sons/checklist-sons.md`, 5.6), so a recorded loop or one-shot replaces a recipe by registering the same id.
import { sceneMany as many, sceneNoise as noise, sceneRecipe, sceneTone as tone } from '@adatechnology/game-audio'
import type { Falloff, Layer, LoopRecipe, SampleAlias, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

import { firingHz } from './engine-mix'
import { BIKE_ENGINE, CAR_ENGINE, TRUCK_ENGINE } from './profiles'
import type { EngineProfile } from './profiles'

/** How a vehicle loop falls off: `1 / (1 + d² × 0.004)`, the game's one-shot curve, with the cutoff muffled by `1 + d × 0.01` (a car far away is dull). */
export const VEHICLE_LOOP_FALLOFF: Falloff = { model: 'inverse_square', k: 0.004, cutoffK: 0.01 }

const SDK = 'sdk: vehicle sounds (sons/checklist-sons.md 5.6)'

// the loops are set every frame by the vehicle: short time constants, so the pitch follows the RPM through a shift
const SMOOTHING = { volume: 0.06, frequency: 0.04 } as const

const toneLoop = (id: string, wave: OscillatorType, filter: BiquadFilterType, cutoff: number, q: number, line: string): LoopRecipe => ({
  id,
  bus: 'world',
  order: 'game_loop',
  source: { kind: 'osc', wave, loop: true },
  filters: { mode: 'serial', bank: [{ type: filter, frequency: { set: cutoff }, q }] },
  smoothing: SMOOTHING,
  falloff: VEHICLE_LOOP_FALLOFF,
  pan: true,
  sources: [SDK, line],
})

const noiseLoop = (id: string, filter: BiquadFilterType, cutoff: number, q: number, line: string): LoopRecipe => ({
  id,
  bus: 'world',
  order: 'game_loop',
  source: { kind: 'noise', offset: 'random', loop: true },
  filters: { mode: 'serial', bank: [{ type: filter, frequency: { set: cutoff }, q }] },
  smoothing: SMOOTHING,
  falloff: VEHICLE_LOOP_FALLOFF,
  pan: true,
  sources: [SDK, line],
})

const engineLoops = (id: string, low: number, mid: number, high: number, load: number): LoopRecipe[] => [
  toneLoop(`engine_${id}_low`, 'sawtooth', 'lowpass', low, 1.4, 'idle and low RPM: the firing frequency, a saw through a low-pass'),
  toneLoop(`engine_${id}_mid`, 'square', 'lowpass', mid, 0.9, 'mid RPM: odd harmonics, the bark'),
  toneLoop(`engine_${id}_high`, 'sawtooth', 'bandpass', high, 1.2, 'high RPM: the second harmonic through a band-pass, the scream near the redline'),
  noiseLoop(`engine_${id}_load`, 'bandpass', load, 0.8, 'intake and exhaust roar, opened by the throttle'),
]

/** The engines (car, truck, bike) and the tyres, as loops. */
export const VEHICLE_LOOPS: readonly LoopRecipe[] = [
  ...engineLoops('car', 400, 900, 1600, 700),
  ...engineLoops('truck', 280, 600, 1000, 500),
  ...engineLoops('bike', 600, 1400, 2800, 1200),
  noiseLoop('tire_skid_asphalt', 'bandpass', 1900, 5, 'rubber squealing on asphalt: a narrow band of noise near 2 kHz'),
  noiseLoop('tire_skid_dirt', 'lowpass', 700, 0.8, 'tyres sliding on dirt and gravel: a dull, wide hiss'),
  noiseLoop('tire_roll', 'lowpass', 400, 0.7, 'road noise of the tyres rolling, brighter with the speed'),
  noiseLoop('tire_roll_gravel', 'bandpass', 1400, 0.6, 'tyres rolling on gravel: a wide crunching hiss, louder with the speed'),
  // a pad on a disc: a thin, nearly pure whistle near 3.4 kHz (a narrow band of noise, so it wavers as a real squeal does)
  // a siren: a square through a low-pass, its pitch swept by the vehicle every frame (wail: a slow rise and fall; yelp: a fast one)
  toneLoop('siren', 'square', 'lowpass', 2600, 0.8, 'emergency siren, the sweep driven by the vehicle'),
  // the blades: a low rumble chopped at the blade-pass rate (≈ 18 Hz for a light helicopter's main rotor)
  {
    ...noiseLoop('helicopter_rotor_loop', 'lowpass', 320, 0.9, 'helicopter rotor: low rumble chopped by the blades'),
    modulators: [{ target: 'gain', wave: 'sine', rate: 18, depth: 0.45, base: 0.55 }],
  },
  noiseLoop('brake_squeal', 'bandpass', 3400, 28, 'brake pads squealing on the discs as the car comes to a stop'),
]

const recipe = (id: string, layers: readonly Layer[], line: string): SoundRecipe => ({ ...sceneRecipe(id, layers, line), sources: [SDK, line] })

// the starter turning the engine over: a compression pulse every ~0.1 s and the motor's whine
const crank = (count: number, spacing: number): Layer[] => [
  { ...noise({ type: 'bandpass', f: [300, 380], q: 1.5, d: 0.07, vol: 0.45 }), repeat: { count, spacing } },
  tone({ wave: 'sawtooth', f: 95, f2: count > 8 ? 70 : 110, d: count * spacing, vol: 0.035 }),
]

// a latch: a short click and a tiny ring
const latch = (delay: number, vol: number): Layer[] => [
  noise({ type: 'bandpass', f: [2600, 3200], q: 3, d: 0.018, vol, delay }),
  tone({ f: 1300, f2: 1180, d: 0.025, vol: vol * 0.15, delay: delay + 0.004 }),
]

/** The one-shots: the starter, the engine stopping, crashes by speed, and the doors, trunk and hood of a car. */
export const VEHICLE_SOUNDS: readonly SoundRecipe[] = [
  // the engine catches at 0.75 s: the loops take over from there (the vehicle flares the RPM)
  recipe('engine_start', [...crank(7, 0.105), tone({ wave: 'sawtooth', f: 45, f2: 27, d: 0.35, vol: 0.3, delay: 0.72 }), noise({ f: 260, d: 0.3, vol: 0.35, delay: 0.72 })], 'starter cranking, then the engine catches'),
  recipe('engine_fail', [...crank(13, 0.125), ...latch(1.65, 0.2)], 'starter cranking slower and slower, the engine never catches, the key released'),
  recipe('engine_stop', [tone({ wave: 'sawtooth', f: 27, f2: 8, d: 0.45, vol: 0.3 }), noise({ f: 200, f2: 60, d: 0.4, vol: 0.32 }), noise({ type: 'bandpass', f: 120, q: 2, d: 0.12, vol: 0.3, delay: 0.32 })], 'ignition off: the engine runs down and shudders to a stop'),
  // light: a dent and plastic giving; medium: the body folding and a pane cracking; heavy: metal folding, glass going, debris falling
  recipe(
    'crash_light',
    [tone({ f: 110, f2: 55, d: 0.16, vol: 0.7 }), noise({ type: 'bandpass', f: 1100, q: 1, d: 0.18, vol: 0.85, wet: 0.2 }), noise({ type: 'highpass', f: 2500, d: 0.05, vol: 0.45 }), ...many(3, () => noise({ type: 'bandpass', f: [1800, 3200], q: 3, d: 0.03, vol: 0.2, delay: [0.03, 0.2] }))],
    'crash below 22 km/h: bumper and plastic, a dull dent',
  ),
  recipe(
    'crash_medium',
    [
      tone({ f: 85, f2: 38, d: 0.3, vol: 1.1 }),
      noise({ type: 'bandpass', f: 700, q: 0.9, d: 0.5, vol: 0.8, wet: 0.3 }),
      ...many(5, () => noise({ type: 'bandpass', f: [500, 1300], q: 2, d: [0.08, 0.18], vol: 0.55, delay: [0, 0.35] })),
      ...many(6, () => tone({ f: [3500, 7000], d: 0.06, vol: 0.08, delay: [0.05, 0.5] })),
    ],
    'crash at 22–50 km/h: the body folding, a pane cracking',
  ),
  recipe(
    'crash_heavy',
    [
      tone({ f: 65, f2: 28, d: 0.6, vol: 1.5 }),
      noise({ f: 900, f2: 150, d: 0.9, vol: 1.3, wet: 0.5 }),
      ...many(9, () => noise({ type: 'bandpass', f: [300, 1200], q: 2, d: [0.1, 0.25], vol: 0.6, delay: [0, 0.7] })),
      noise({ type: 'highpass', f: 3200, d: 0.5, vol: 0.7, delay: 0.03, wet: 0.4 }),
      ...many(14, () => tone({ f: [3000, 7500], d: [0.05, 0.12], vol: 0.12, delay: [0.05, 1.2] })),
      ...many(6, () => noise({ type: 'bandpass', f: [1500, 3000], q: 2, d: 0.04, vol: 0.25, delay: [0.5, 1.5] })),
    ],
    'crash above 50 km/h: metal folding, the glass going, debris falling',
  ),
  // a body hit by a car: the dull slap of the bumper on a person, the body folding over the bonnet, at speed a crack of the windscreen
  recipe(
    'vehicle_hit_pedestrian',
    [
      tone({ f: 95, f2: 50, d: 0.14, vol: 0.9 }),
      noise({ type: 'lowpass', f: 600, d: 0.12, vol: 0.8 }),
      noise({ type: 'bandpass', f: 280, q: 1.2, d: 0.18, vol: 0.55, delay: 0.09 }),
      noise({ type: 'highpass', f: 2600, d: 0.05, vol: 0.18, delay: 0.1 }),
    ],
    'a person hit by a car: the bumper slap, the body on the bonnet',
  ),
  // the game's horn (two squares at 415 and 523 Hz, jogo L70272) heard from where the car is; a truck's air horn lower and longer
  recipe('horn_car', [tone({ wave: 'square', f: 415, d: 0.6, vol: 0.09 }), tone({ wave: 'square', f: 523, d: 0.6, vol: 0.09 })], 'car horn: the game chord, placed and panned'),
  recipe('horn_truck', [tone({ wave: 'sawtooth', f: 220, d: 1.1, vol: 0.1 }), tone({ wave: 'sawtooth', f: 277, d: 1.1, vol: 0.08 }), noise({ type: 'bandpass', f: 900, q: 2, d: 1.1, vol: 0.05 })], 'truck air horn: low reedy chord'),
  recipe('horn_bike', [tone({ wave: 'square', f: 620, d: 0.35, vol: 0.07 }), tone({ wave: 'square', f: 780, d: 0.35, vol: 0.07 })], 'motorcycle horn: a short, thin two-note beep'),
  // the compressed air let out of a truck's brake chambers as it stops: a hiss that dies away
  recipe('air_brake', [noise({ type: 'highpass', f: 2200, a: 0.01, d: 1.1, vol: 0.28 }), noise({ type: 'bandpass', f: 900, q: 0.8, d: 0.35, vol: 0.2 }), tone({ f: 120, f2: 70, d: 0.12, vol: 0.2 })], 'air brakes: the chambers venting as the truck stops'),
  // a car door is a padded "tum" with a latch, not a hollow metal box (the fridge's shut_metal)
  recipe('car_door_open', [...latch(0, 0.32), noise({ f: 400, d: 0.06, vol: 0.14, delay: 0.035 })], 'car door: the handle pulled, the latch released, the seal letting go'),
  recipe('car_door_close', [tone({ f: 75, f2: 48, d: 0.16, vol: 0.75 }), noise({ f: 320, d: 0.1, vol: 0.6 }), ...latch(0.012, 0.3)], 'car door shut: a dull padded thump and the latch catching'),
  recipe('car_trunk_close', [tone({ f: 90, f2: 55, d: 0.15, vol: 0.65 }), noise({ type: 'bandpass', f: 500, q: 1, d: 0.12, vol: 0.5 }), ...latch(0.01, 0.28), noise({ type: 'bandpass', f: 1800, q: 3, d: 0.04, vol: 0.1, delay: 0.06 })], 'trunk or hatch shut: a lighter thump, the latch and a small rattle'),
  recipe('car_hood_open', [...latch(0, 0.3), tone({ f: [180, 230], f2: 140, d: 0.3, vol: 0.04, delay: 0.06 }), noise({ type: 'bandpass', f: 700, q: 2, d: 0.25, vol: 0.12, delay: 0.05 })], 'hood released: the latch giving and the lid rising a little on its springs'),
  recipe('car_hood_close', [tone({ f: 70, f2: 40, d: 0.22, vol: 0.8 }), noise({ type: 'bandpass', f: 850, q: 1.4, d: 0.2, vol: 0.6, wet: 0.3 }), tone({ f: 900, f2: 860, d: 0.18, vol: 0.05 }), ...latch(0.015, 0.3)], 'hood slammed: a big sheet of metal ringing a little, the latch'),
]

/**
 * The RPM each car recording runs at, measured on the files (the crank turning at 16.7 and 42 Hz, the firing at four times that: a V8). A layer
 * plays its file at `rpm / recorded rpm`.
 */
export const CAR_RECORDED_RPM = { idle: 1000, high: 2520 } as const

/** Where the start and the stop sit in the recording of a car starting, running and stopping (`engine_start_run_stop`), in seconds. */
export const CAR_START_RUN_STOP = {
  /** The take the times below were measured on. */
  take: '_01.',
  /** The starter and the engine catching (at 0.58 s) and flaring; the loops take over at the crank time of the vehicle. */
  start: { offset: 0, duration: 1.3 },
  /** The ignition off: the engine running down to the end of the file. */
  stop: { offset: 9.96, duration: 0.64 },
} as const

/** A layer of another engine profile read from its idle recording, played at the pitch it was recorded at when the engine idles. */
const idleLayer = (id: string, file: string, rpm: number, profile: EngineProfile): SampleAlias => ({
  id,
  file,
  loop: true,
  baseFrequency: firingHz(profile, rpm),
  falloff: VEHICLE_LOOP_FALLOFF,
})

const carLayer = (id: string, file: string, rpm: number, harmonic: number, offset?: number): SampleAlias => ({
  id,
  file,
  loop: true,
  // the layer's oscillator plays the firing frequency times its harmonic: the file sounds at that frequency for the RPM it was recorded at
  baseFrequency: firingHz(CAR_ENGINE, rpm) * harmonic,
  falloff: VEHICLE_LOOP_FALLOFF,
  ...(offset === undefined ? {} : { offset }),
})

/**
 * The vehicle ids answered by the recordings of the kit's manifest (files kept by the game, never in the SDK): the car engine layers by RPM, the
 * start and the stop cut out of one recording, the door, the trunk and the hood, the crashes, the tyres on asphalt and on gravel, and the idle of a
 * truck and of a motorcycle. Each recipe above stays as the fallback while the files load or where the game has none. `car_door_open`, `car_hood_open`,
 * `air_brake` and the horns (`horn_car`, `horn_truck`, `horn_bike`) are file ids of their own and need no alias.
 */
export const VEHICLE_SAMPLE_ALIASES: readonly SampleAlias[] = [
  carLayer('engine_car_low', 'engine_loop_car_idle', CAR_RECORDED_RPM.idle, 1),
  carLayer('engine_car_mid', 'engine_loop_car_high', CAR_RECORDED_RPM.high, 1),
  // the same file as the mid layer, read from two seconds in, so the two do not sum in phase where they cross
  carLayer('engine_car_high', 'engine_loop_car_high', CAR_RECORDED_RPM.high, 2, 2),
  // the cut points are of take _01 (10.6 s); _02 (21.9 s) starts already running and idles at 9.96 s, so it is left out of both
  { id: 'engine_start', file: 'engine_start_run_stop', only: CAR_START_RUN_STOP.take, ...CAR_START_RUN_STOP.start, falloff: VEHICLE_LOOP_FALLOFF },
  { id: 'engine_stop', file: 'engine_start_run_stop', only: CAR_START_RUN_STOP.take, ...CAR_START_RUN_STOP.stop, falloff: VEHICLE_LOOP_FALLOFF },
  { id: 'car_door_close', file: 'car_door_shut' },
  { id: 'car_trunk_close', file: 'car_trunk_shut' },
  { id: 'car_hood_close', file: 'car_hood_shut' },
  // a crash by speed: a dent in the plastic, the body folding, the wreck (file ids that are not the recipes' own: `crash_light` and its kin would read as tiers of `crash`)
  { id: 'crash_light', file: 'crash_dent' },
  { id: 'crash_medium', file: 'crash_fold' },
  { id: 'crash_heavy', file: 'crash_wreck' },
  // tyres: the squeal of rubber on asphalt and the crunch of gravel, chained like the engines
  { id: 'tire_skid_asphalt', file: 'tire_skid_asphalt_loop', loop: { crossfade: 0.6 }, falloff: VEHICLE_LOOP_FALLOFF },
  { id: 'tire_roll_gravel', file: 'tire_roll_gravel_loop', loop: { crossfade: 0.6 }, falloff: VEHICLE_LOOP_FALLOFF },
  // the idle of a truck and of a motorcycle, at the profile's idle RPM (the take plays at its own pitch there); the other layers stay on their recipes
  idleLayer('engine_truck_low', 'engine_loop_truck_idle', TRUCK_ENGINE.idleRpm, TRUCK_ENGINE),
  idleLayer('engine_bike_low', 'engine_loop_bike_idle', BIKE_ENGINE.idleRpm, BIKE_ENGINE),
]

/** The ids a host should decode as the vehicles load (`AudioSink.preload`): every aliased recording and the door's own file id. */
export const VEHICLE_PRELOAD_SOUNDS: readonly string[] = [...VEHICLE_SAMPLE_ALIASES.map((alias) => alias.id), 'car_door_open', 'car_hood_open', 'horn_car', 'horn_truck', 'horn_bike', 'air_brake']

export const VEHICLE_SOUND_BANK: SoundBank = { id: 'vehicles_three', sounds: VEHICLE_SOUNDS, loops: VEHICLE_LOOPS, sampleAliases: VEHICLE_SAMPLE_ALIASES }
