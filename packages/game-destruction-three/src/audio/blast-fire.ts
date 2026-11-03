// Blasts and fire: the kit's synthesized sounds for each family of explosive (grenade, big charge, fuel, car, pipe bomb, rocket, flashbang, molotov),
// the far and the indoor versions of a blast, and the fire (ignition, roar, crackle, gas leak, put out). Synthesized until recorded files reach the
// SDK; each recipe is built so the loudest moment is the first few milliseconds (the crack of the blast lands on the frame of the event), the body
// and the debris follow, and every frequency and timing is a range so no two plays sound alike.
import { sceneMany as many, sceneNoise as noise, sceneRecipe, sceneTone as tone } from '@adatechnology/game-audio'
import type { Falloff, Layer, LoopRecipe, SoundRecipe } from '@adatechnology/game-audio'

/** A blast near the listener: loud for tens of metres; lowpass cutoffs fall with distance. */
export const BLAST_FALLOFF: Falloff = { model: 'inverse_square', k: 0.0012, cutoffK: 0.006, minGain: 0.002 }
/** A blast far away (past `BLAST_FAR_DISTANCE`): heard for hundreds of metres. */
export const BLAST_FAR_FALLOFF: Falloff = { model: 'inverse_square', k: 0.00008, scale: 0.3, minGain: 0.001 }
/** Fire, ignition and crackles: a room-size sound. */
export const FIRE_FALLOFF: Falloff = { model: 'inverse_square', k: 0.01, cutoffK: 0.01, minGain: 0.005 }
/** Metres from the listener past which a blast plays its far version. */
export const BLAST_FAR_DISTANCE = 60

/** The explosion families, each with its own sound. */
export const BLAST_KINDS = ['grenade', 'big', 'fuel', 'car', 'pipe_bomb', 'rocket', 'flashbang', 'molotov'] as const
export type BlastKind = (typeof BLAST_KINDS)[number]

/**
 * Which family each named explosion of `@adatechnology/game-vfx` (`explosions.json`, the `effect` of an explosive part) belongs to. Data: a game adds
 * or changes entries through `DestructionSoundOptions.blastKinds`. An explosion without a known effect is a grenade below `BIG_BLAST_RADIUS` and a big
 * charge above it.
 */
export const BLAST_KIND_OF: Readonly<Record<string, BlastKind>> = {
  m67: 'grenade',
  vog_25: 'grenade',
  m79_40mm: 'grenade',
  claymore: 'grenade',
  generic: 'grenade',
  c4: 'big',
  dynamite: 'big',
  fuel_station_tank: 'big',
  propane_p13: 'fuel',
  fuel_barrel: 'fuel',
  fuel_pump: 'fuel',
  car_fuel_tank: 'car',
  pipe_bomb: 'pipe_bomb',
  m72_66mm: 'rocket',
  at4_84mm: 'rocket',
  carl_gustaf_84mm: 'rocket',
  pg7v: 'rocket',
  flashbang: 'flashbang',
  molotov: 'molotov',
}

/** Blast radius (metres) from which an explosion with no known effect is a big charge. */
export const BIG_BLAST_RADIUS = 8

const blast = (id: string, layers: readonly Layer[], sources: readonly string[], falloff: Falloff = BLAST_FALLOFF): SoundRecipe => ({
  ...sceneRecipe(id, layers, ''),
  falloff,
  sources,
})

// the instant crack of the shock front: the loudest part, in the first milliseconds
const crack = (f: readonly [number, number], d: number, vol: number): Layer => noise({ type: 'highpass', f, a: 0.001, d, vol })
// stones, wood and metal falling back after the blast, spread over `[from, to]` seconds
const debris = (count: number, from: number, to: number, vol: readonly [number, number]): Layer[] => [
  ...many(count, () => noise({ type: 'bandpass', f: [300, 1400], q: 2.5, d: [0.03, 0.09], vol, delay: [from, to] })),
  ...many(Math.ceil(count / 3), () => noise({ type: 'bandpass', f: [1800, 3600], q: 5, d: [0.02, 0.04], vol: [vol[0] * 0.6, vol[1] * 0.6] as const, delay: [from + 0.1, to] })),
]
// steel fragments whizzing and striking around the blast
const shrapnel = (count: number, to: number): Layer[] => many(count, () => noise({ type: 'bandpass', f: [2500, 6000], q: 6, d: [0.015, 0.045], vol: [0.08, 0.16], delay: [0.02, to] }))
// glass panes breaking and their shards falling
const glass = (count: number, from: number): Layer[] => [
  noise({ type: 'highpass', f: [2600, 3000], d: 0.4, vol: 0.7, wet: 0.5, delay: from }),
  ...many(count, () => tone({ f: [3000, 7500], d: [0.05, 0.13], vol: 0.12, delay: [from, from + 0.7] })),
]

/** One sound per explosion family, the far and the indoor versions. */
export const BLAST_SOUNDS: readonly SoundRecipe[] = [
  blast(
    'explosion_grenade',
    [
      crack([2300, 2700], 0.06, 2.4),
      noise({ f: [2500, 3000], f2: 160, d: 0.7, vol: 2, wet: 0.35 }),
      tone({ f: [80, 92], f2: 32, d: 0.5, vol: 1.6 }),
      noise({ type: 'bandpass', f: [620, 760], q: 0.8, d: 0.18, vol: 1.1 }),
      ...shrapnel(14, 0.7),
      ...debris(10, 0.35, 1.8, [0.1, 0.2]),
    ],
    ['sdk: frag grenade (M67, VOG-25, 40 mm): sharp crack, short body, fragments striking, a little debris'],
  ),
  blast(
    'explosion_big',
    [
      crack([1900, 2300], 0.08, 2.4),
      noise({ f: [2200, 2600], f2: 90, d: 1.6, vol: 2.2, wet: 0.45 }),
      tone({ f: [52, 60], f2: 22, d: 1.6, vol: 1.9 }),
      noise({ f: [280, 330], f2: 60, a: 0.25, d: 2.8, vol: 0.8, wet: 0.6, delay: 0.05 }),
      ...debris(24, 0.5, 3.6, [0.12, 0.25]),
    ],
    ['sdk: big charge (C4, dynamite, a fuel station tank): crack, long deep roar, debris falling for 2 to 4 s'],
  ),
  blast(
    'explosion_fuel',
    [
      noise({ type: 'highpass', f: [1700, 2000], a: 0.001, d: 0.05, vol: 1 }),
      tone({ f: [380, 450], f2: 300, d: 0.4, vol: 0.3 }),
      noise({ f: [1700, 2000], f2: 150, a: 0.03, d: 1.4, vol: 2.1, wet: 0.4 }),
      tone({ f: [48, 56], f2: 25, d: 1.2, vol: 1.7 }),
      noise({ type: 'bandpass', f: [450, 560], q: 0.6, a: 0.15, d: 2.2, vol: 0.85, wet: 0.5, delay: 0.1 }),
      ...debris(10, 0.5, 2.6, [0.08, 0.16]),
    ],
    ['sdk: a fuel vessel bursting (propane P13, fuel barrel, pump): the shell tearing, a fireball "whoomp" and its roar'],
  ),
  blast(
    'explosion_car',
    [
      noise({ type: 'highpass', f: [1700, 2000], a: 0.001, d: 0.06, vol: 1.1 }),
      noise({ f: [1600, 1900], f2: 140, a: 0.03, d: 1.6, vol: 2.1, wet: 0.4 }),
      tone({ f: [44, 52], f2: 24, d: 1.4, vol: 1.8 }),
      noise({ type: 'bandpass', f: [420, 520], q: 0.6, a: 0.15, d: 2.6, vol: 0.9, wet: 0.5, delay: 0.1 }),
      ...glass(10, 0.04),
      tone({ f: [130, 150], f2: 85, d: 1.1, vol: 0.18, delay: [0.3, 0.5] }),
      ...debris(16, 0.6, 3.2, [0.1, 0.2]),
    ],
    ['sdk: a car going up: the fuel tank fireball, every window breaking, the body groaning, parts falling'],
  ),
  blast(
    'explosion_pipe_bomb',
    [
      crack([2000, 2400], 0.07, 2.2),
      noise({ f: [2000, 2400], f2: 150, d: 0.8, vol: 1.9, wet: 0.35 }),
      tone({ f: [70, 82], f2: 30, d: 0.6, vol: 1.5 }),
      ...many(6, () => tone({ f: [1800, 3200], f2: 1200, d: [0.06, 0.12], vol: 0.06, delay: [0.05, 0.6] })),
      ...shrapnel(18, 0.9),
      ...debris(8, 0.4, 1.8, [0.08, 0.16]),
    ],
    ['sdk: pipe bomb: crack, body, the steel pipe flying apart in ringing pieces'],
  ),
  blast(
    'explosion_rocket',
    [
      crack([2100, 2500], 0.08, 2.4),
      noise({ f: [2400, 2800], f2: 120, d: 1.1, vol: 2.1, wet: 0.4 }),
      tone({ f: [60, 70], f2: 26, d: 0.9, vol: 1.8 }),
      noise({ f: [350, 420], f2: 80, a: 0.08, d: 1.8, vol: 0.9, wet: 0.6, delay: 0.05 }),
      ...shrapnel(10, 0.8),
      ...debris(16, 0.4, 2.6, [0.1, 0.2]),
    ],
    ['sdk: rocket or anti-tank warhead (M72, AT4, RPG): hard crack, heavy body, debris'],
  ),
  blast(
    'explosion_flashbang',
    [crack([1400, 1700], 0.12, 2.8), noise({ f: [1900, 2200], f2: 300, d: 0.35, vol: 1.3, wet: 0.3 }), tone({ f: [110, 130], f2: 60, d: 0.2, vol: 0.8 })],
    ['sdk: flashbang: a deafening crack with almost no body and no fragments'],
  ),
  blast(
    'molotov_break_ignite',
    [
      ...glass(8, 0),
      noise({ f: [280, 340], f2: 2200, a: 0.12, d: 0.9, vol: 1.5, wet: 0.6, delay: 0.05 }),
      tone({ f: [85, 95], f2: 55, d: 0.4, vol: 0.5, delay: 0.08 }),
    ],
    ['sdk: molotov: the bottle breaking and the fuel catching with a "fuuush"'],
    FIRE_FALLOFF,
  ),
  blast(
    'explosion_far',
    [
      noise({ f: [550, 650], f2: 80, a: 0.03, d: 2.5, vol: 2, wet: 1.4 }),
      tone({ f: [42, 48], f2: 25, d: 1.8, vol: 1.2 }),
      noise({ f: [350, 420], f2: 70, a: 0.1, d: 1.6, vol: 0.6, wet: 1.5, delay: [0.6, 1] }),
    ],
    ['sdk: any blast far away: no crack left, a dull thud and the echo rolling back'],
    BLAST_FAR_FALLOFF,
  ),
  blast(
    'explosion_indoor_tail',
    [
      ...many(3, () => noise({ f: [650, 800], d: 0.12, vol: 0.5, delay: [0.04, 0.2] })),
      noise({ f: [850, 950], f2: 120, a: 0.05, d: 2.6, vol: 0.9, wet: 1.6, delay: 0.08 }),
    ],
    ['sdk: the room answering a blast inside it: slaps off the walls and a boomy tail'],
  ),
]

/** Fire: ignition, gas leaking from a vessel about to burst, a fire put out, and the crackles that ride on the fire loop. */
export const FIRE_SOUNDS: readonly SoundRecipe[] = [
  {
    ...blast(
    'fire_ignite',
    [noise({ f: [230, 270], f2: 1500, a: 0.07, d: 0.5, vol: 1.6 }), tone({ f: [80, 90], f2: 55, d: 0.3, vol: 0.45 }), noise({ type: 'highpass', f: 3000, d: 0.3, vol: 0.1, delay: 0.1 })],
    ['sdk: fire catching, a soft "fuuump"'],
    FIRE_FALLOFF,
    ),
    group: 'fire_ignite',
  },
  {
    ...blast('gas_leak', [noise({ type: 'bandpass', f: [3200, 3800], q: 0.7, a: 0.08, d: { param: 'seconds' }, vol: 0.45 })], ['sdk: gas jetting from a punctured vessel'], FIRE_FALLOFF),
    vars: { seconds: 2 },
  },
  {
    ...blast(
      'fire_extinguish',
      [noise({ type: 'highpass', f: [2300, 2700], a: 0.03, d: { param: 'seconds' }, vol: 0.3 }), noise({ type: 'bandpass', f: [800, 1000], q: 0.5, d: 0.5, vol: 0.25 })],
      ['sdk: water or foam on a fire: a steam puff and a sizzle'],
      FIRE_FALLOFF,
    ),
    vars: { seconds: 1.2 },
  },
  { ...blast('fire_crackle', [noise({ type: 'highpass', f: [1500, 3000], d: [0.01, 0.025], vol: [1.2, 2.2] })], ['sdk: a crackle of the fire'], FIRE_FALLOFF), group: 'fire_crackle' },
  { ...blast('fire_pop', [noise({ type: 'bandpass', f: [500, 1100], q: 1, d: [0.03, 0.06], vol: [1.4, 2.2] })], ['sdk: a log or a resin pocket popping'], FIRE_FALLOFF), group: 'fire_crackle' },
]

/** The roar of the fires: low, soft noise; `createDestructionSound` raises it with every part that burns and sprinkles crackles on it. */
export const FIRE_LOOP: LoopRecipe = {
  id: 'fire_loop',
  bus: 'world',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 950 }, q: 0.5 }] },
  volume: 0,
  sources: ['sdk: the roar under the crackles of a fire'],
}

/** The sound of a blast family. */
export const BLAST_SOUND_OF: Readonly<Record<BlastKind, string>> = {
  grenade: 'explosion_grenade',
  big: 'explosion_big',
  fuel: 'explosion_fuel',
  car: 'explosion_car',
  pipe_bomb: 'explosion_pipe_bomb',
  rocket: 'explosion_rocket',
  flashbang: 'explosion_flashbang',
  molotov: 'molotov_break_ignite',
}
