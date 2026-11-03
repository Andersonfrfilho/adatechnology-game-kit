// The sounds of a body: footsteps by surface and gait, landings, the swing and the hit of each blow, hurt, bite and grab. Synthesised in the meantime
// (the kit has no recorded take of these yet): each id is a set of four takes, with the numbers of each take apart, so the same action never
// sounds twice the same. A recorded take replaces a variant by its id (`register` a bank with the same recipe id) without touching who plays it.
//
// How each one is built (what the ear picks first):
// - a footstep is the heel (a low thump, how hollow the floor is) and then the roll to the toe (the surface's own texture: the grit of concrete,
//   the crunch of gravel, the ring of a metal sheet, the splash of water); a run hits harder, brighter and shorter, heel and toe almost together;
// - a landing is the whole body's weight on the surface: a deeper thump, the surface texture longer, the clothes after;
// - a swing is air: a band of noise sweeping up while the limb or the tool speeds up, loudest just before the contact, so it is started early
//   (`SWING_LEAD_SECONDS` of game-contracts) and the contact sound follows it;
// - a hit on a body is skin (a slap), mass (a thud) and, for a blade, a wet tear; on an object it is only the striking part (knuckles, sole, steel)
//   and the material's own impact plays beside it.
import {
  BODY_SOUND_IDS,
  FOOTSTEP_SOUND_IDS,
  GAIT_IDS,
  LAND_SOUND_IDS,
  LANDING_IDS,
  SURFACE_IDS,
  SWING_LEAD_SECONDS,
  footstepSoundId,
} from '@adatechnology/game-contracts'
import type { BlowId, BodySoundId, GaitId, LandingId, SurfaceId } from '@adatechnology/game-contracts'

import type { Falloff, Layer, SoundBank, SoundRecipe, SoundSet } from '../recipe'
import { sceneNoise, sceneTone, sceneVoice } from './scene'

/** Takes per id. */
export const BODY_FOLEY_TAKES = 4

/** How each take differs from the first: frequency factor, timing factor and level factor (fixed numbers, so takes are really apart). */
const TAKES: readonly { readonly f: number; readonly t: number; readonly v: number }[] = [
  { f: 1, t: 1, v: 1 },
  { f: 1.08, t: 0.9, v: 0.92 },
  { f: 0.93, t: 1.12, v: 1.05 },
  { f: 1.03, t: 1.05, v: 0.88 },
]


/** Footsteps fade fast with distance and lose their top: a step 10 m away is a quarter of the level, 30 m a few percent, and duller. */
export const FOOTSTEP_FALLOFF: Falloff = { model: 'inverse_square', k: 0.03, cutoffK: 0.03, minGain: 0.004 }
/** Blows and body sounds carry further than a step. */
export const BODY_FALLOFF: Falloff = { model: 'inverse_square', k: 0.012, cutoffK: 0.015, minGain: 0.004 }

type Take = (typeof TAKES)[number]

/** What a surface sounds like under a foot: the heel's thump and the texture of the roll. */
type SurfaceVoice = {
  /** The heel: thump pitch (Hz), its length (s) and level. */
  readonly heel: { readonly f: number; readonly d: number; readonly vol: number }
  /** The roll to the toe and the scuff: a filtered noise. */
  readonly roll: { readonly type: BiquadFilterType; readonly f: number; readonly q: number; readonly d: number; readonly vol: number }
  /** Grit, crunch or drips: short bursts spread after the heel. */
  readonly grains?: { readonly count: number; readonly f: number; readonly q: number; readonly spread: number; readonly vol: number }
  /** A ring of the floor itself (a hollow board, a metal sheet). */
  readonly ring?: readonly { readonly f: number; readonly d: number; readonly vol: number }[]
  /** Water: a sweep of the splash band. */
  readonly splash?: { readonly f: number; readonly f2: number; readonly d: number; readonly vol: number }
}

const SURFACES: Readonly<Record<SurfaceId, SurfaceVoice>> = {
  concrete: { heel: { f: 95, d: 0.05, vol: 0.55 }, roll: { type: 'bandpass', f: 2300, q: 1.1, d: 0.05, vol: 0.38 }, grains: { count: 2, f: 4200, q: 2, spread: 0.04, vol: 0.08 } },
  asphalt: { heel: { f: 90, d: 0.05, vol: 0.5 }, roll: { type: 'bandpass', f: 1700, q: 0.9, d: 0.06, vol: 0.36 }, grains: { count: 4, f: 3600, q: 2.5, spread: 0.06, vol: 0.1 } },
  wood: { heel: { f: 130, d: 0.08, vol: 0.55 }, roll: { type: 'lowpass', f: 1300, q: 0.8, d: 0.06, vol: 0.3 }, ring: [{ f: 210, d: 0.1, vol: 0.18 }, { f: 470, d: 0.06, vol: 0.06 }] },
  tile: { heel: { f: 110, d: 0.04, vol: 0.45 }, roll: { type: 'bandpass', f: 3600, q: 2, d: 0.03, vol: 0.42 }, ring: [{ f: 1900, d: 0.03, vol: 0.05 }] },
  dirt: { heel: { f: 75, d: 0.06, vol: 0.45 }, roll: { type: 'lowpass', f: 750, q: 0.7, d: 0.09, vol: 0.4 }, grains: { count: 3, f: 1800, q: 1.5, spread: 0.07, vol: 0.06 } },
  grass: { heel: { f: 70, d: 0.05, vol: 0.32 }, roll: { type: 'highpass', f: 2600, q: 0.7, d: 0.13, vol: 0.28 }, grains: { count: 4, f: 5200, q: 1.2, spread: 0.1, vol: 0.07 } },
  gravel: { heel: { f: 80, d: 0.05, vol: 0.4 }, roll: { type: 'lowpass', f: 950, q: 0.8, d: 0.1, vol: 0.3 }, grains: { count: 8, f: 2600, q: 3, spread: 0.13, vol: 0.2 } },
  sand: { heel: { f: 65, d: 0.06, vol: 0.3 }, roll: { type: 'bandpass', f: 1500, q: 0.6, d: 0.16, vol: 0.3 }, grains: { count: 5, f: 4800, q: 1.5, spread: 0.12, vol: 0.05 } },
  metal: { heel: { f: 120, d: 0.05, vol: 0.5 }, roll: { type: 'bandpass', f: 2800, q: 1.5, d: 0.03, vol: 0.25 }, ring: [{ f: 420, d: 0.25, vol: 0.16 }, { f: 1130, d: 0.18, vol: 0.09 }, { f: 2470, d: 0.1, vol: 0.04 }] },
  water: { heel: { f: 70, d: 0.04, vol: 0.25 }, roll: { type: 'bandpass', f: 3000, q: 1.2, d: 0.1, vol: 0.18 }, splash: { f: 1100, f2: 380, d: 0.22, vol: 0.55 }, grains: { count: 4, f: 2400, q: 6, spread: 0.18, vol: 0.12 } },
  glass: { heel: { f: 90, d: 0.04, vol: 0.4 }, roll: { type: 'highpass', f: 4500, q: 0.8, d: 0.06, vol: 0.2 }, grains: { count: 9, f: 6200, q: 5, spread: 0.12, vol: 0.22 }, ring: [{ f: 3900, d: 0.04, vol: 0.04 }, { f: 5300, d: 0.03, vol: 0.03 }] },
  carpet: { heel: { f: 70, d: 0.05, vol: 0.32 }, roll: { type: 'lowpass', f: 420, q: 0.7, d: 0.07, vol: 0.3 } },
}

const GAITS: Readonly<Record<GaitId, { readonly vol: number; readonly bright: number; readonly toe: number; readonly short: number }>> = {
  walk: { vol: 1, bright: 1, toe: 0.075, short: 1 },
  run: { vol: 1.35, bright: 1.25, toe: 0.035, short: 0.75 },
}

const grainLayers = (g: NonNullable<SurfaceVoice['grains']>, take: Take, start: number, scale: number): Layer[] =>
  Array.from({ length: g.count }, (_, i) =>
    sceneNoise({ type: 'bandpass', f: [g.f * take.f * 0.85, g.f * take.f * 1.15], q: g.q, d: [0.008, 0.02], vol: g.vol * scale * take.v, delay: start + ((i + 0.5) / g.count) * g.spread * take.t }),
  )

const ringLayers = (rings: NonNullable<SurfaceVoice['ring']>, take: Take, scale: number, at = 0): Layer[] =>
  rings.map((r) => sceneTone({ f: r.f * take.f, d: r.d * take.t, vol: r.vol * scale * take.v, delay: at }))

/** The layers of one foot on a surface: heel, roll to the toe, then grains, ring or splash. `weight` scales the heel (a landing is the whole body). */
function footLayers(surface: SurfaceId, take: Take, gait: (typeof GAITS)[GaitId], weight = 1): Layer[] {
  const s = SURFACES[surface]
  const toe = gait.toe * take.t
  return [
    sceneTone({ f: s.heel.f * take.f * weight ** -0.3, f2: s.heel.f * take.f * 0.6, d: s.heel.d * gait.short * take.t * weight ** 0.5, vol: s.heel.vol * gait.vol * take.v * weight ** 0.5 }),
    sceneNoise({ type: 'lowpass', f: 500 * gait.bright, d: 0.02 * take.t, vol: 0.18 * gait.vol * take.v * weight ** 0.5 }),
    sceneNoise({ type: s.roll.type, f: [s.roll.f * take.f * gait.bright * 0.92, s.roll.f * take.f * gait.bright * 1.08], q: s.roll.q, d: s.roll.d * gait.short * take.t * weight ** 0.3, vol: s.roll.vol * gait.vol * take.v, delay: toe }),
    ...(s.grains ? grainLayers(s.grains, take, toe * 0.5, gait.vol * weight ** 0.5) : []),
    ...(s.ring ? ringLayers(s.ring, take, gait.vol * weight ** 0.5) : []),
    ...(s.splash ? [sceneNoise({ type: 'bandpass', f: s.splash.f * take.f, f2: s.splash.f2 * take.f, q: 1.4, d: s.splash.d * take.t * weight ** 0.4, vol: s.splash.vol * gait.vol * take.v * weight ** 0.5 })] : []),
  ]
}

/** The layers at `level` of their gain (a scene layer's gain is a number or a range). */
const quieter = (level: number, layers: readonly Layer[]): Layer[] =>
  layers.map((layer) => {
    const gain = layer.gain ?? 1
    if (typeof gain === 'number') return { ...layer, gain: gain * level }
    if (Array.isArray(gain)) return { ...layer, gain: [gain[0] * level, gain[1] * level] as const }
    return layer
  })

const recipe = (id: string, layers: readonly Layer[], falloff: Falloff, bus: SoundRecipe['bus'] = 'world'): SoundRecipe => ({ id, bus, pan: true, layers, falloff, sources: ['sdk'] })

const takeId = (id: string, index: number): string => `${id}_${String(index + 1).padStart(2, '0')}`

/** The four takes of an id and the set that names them. */
function takes(id: string, layersOf: (take: Take, index: number) => Layer[], falloff: Falloff, rate: readonly [number, number] = [0.96, 1.04], bus?: SoundRecipe['bus']): { sounds: SoundRecipe[]; set: SoundSet } {
  const sounds = TAKES.map((take, index) => recipe(takeId(id, index), layersOf(take, index), falloff, bus))
  return { sounds, set: { id, variants: sounds.map((sound) => sound.id), rate } }
}

const footstep = (surface: SurfaceId, gait: GaitId) => takes(footstepSoundId(surface, gait), (take) => footLayers(surface, take, GAITS[gait]), FOOTSTEP_FALLOFF)

const LANDINGS: Readonly<Record<LandingId, { readonly weight: number; readonly cloth: number }>> = { light: { weight: 1.4, cloth: 0.12 }, heavy: { weight: 2.4, cloth: 0.22 } }

/** A landing's layers are the feet's at the body's weight; this brings the whole of it under a blow on a body (C6). */
const LANDING_LEVEL = 0.65

const landing = (surface: SurfaceId, landing: LandingId) =>
  takes(
    `land_${surface}_${landing}`,
    (take) => quieter(LANDING_LEVEL, [
      // both feet, a hair apart, then the knees taking the weight (a low body thump) and the clothes settling
      ...footLayers(surface, take, GAITS.run, LANDINGS[landing].weight),
      ...footLayers(surface, { ...take, v: take.v * 0.6 }, GAITS.run, LANDINGS[landing].weight * 0.6).map((layer) => ({ ...layer, at: (typeof layer.at === 'number' ? layer.at : 0) + 0.018 * take.t })),
      sceneTone({ f: 60 * take.f, f2: 38, d: 0.14 * LANDINGS[landing].weight * take.t, vol: 0.22 * LANDINGS[landing].weight ** 0.7 * take.v, delay: 0.02 }),
      sceneNoise({ type: 'bandpass', f: [1800, 2600], q: 0.8, d: 0.18, vol: LANDINGS[landing].cloth * take.v, delay: 0.04 }),
    ]),
    FOOTSTEP_FALLOFF,
  )

const whoosh = (blow: BlowId, from: number, to: number, d: number, vol: number, q = 1.6): ((take: Take) => Layer[]) => (take) => [
  // the air: a band sweeping up as the limb speeds up; it peaks `SWING_LEAD_SECONDS` in, the moment before the contact, then dies away
  sceneNoise({ type: 'bandpass', f: from * take.f, f2: to * take.f, q, a: SWING_LEAD_SECONDS[blow], d: d * take.t, vol: vol * take.v }),
  sceneNoise({ type: 'lowpass', f: 600 * take.f, a: SWING_LEAD_SECONDS[blow], d: d * take.t * 0.8, vol: vol * 0.35 * take.v }),
]

/** Skin, mass and (optionally) bone: what a blow on a body is made of. */
const fleshHit = (o: { slap: number; slapF: number; thud: number; thudF: number; thudD: number; crack?: number; wet?: number }): ((take: Take) => Layer[]) => (take) => [
  sceneNoise({ type: 'bandpass', f: o.slapF * take.f, q: 1.2, d: 0.03 * take.t, vol: o.slap * take.v }),
  sceneNoise({ type: 'highpass', f: 3500 * take.f, d: 0.012, vol: o.slap * 0.4 * take.v }),
  sceneTone({ f: o.thudF * take.f, f2: o.thudF * 0.5, d: o.thudD * take.t, vol: o.thud * take.v }),
  sceneNoise({ type: 'lowpass', f: 600 * take.f, d: o.thudD * 1.2 * take.t, vol: o.thud * 0.5 * take.v }),
  ...(o.crack ? [sceneNoise({ type: 'highpass', f: 2500, d: 0.015, vol: o.crack * take.v, delay: 0.006 }), sceneTone({ wave: 'square', f: 900 * take.f, f2: 300, d: 0.02, vol: o.crack * 0.15 * take.v, delay: 0.006 })] : []),
  ...(o.wet ? [sceneNoise({ type: 'bandpass', f: 1400 * take.f, f2: 500, q: 2.5, d: 0.12 * take.t, vol: o.wet * take.v, delay: 0.01 })] : []),
]

/** What only the striking part sounds like on a hard thing (the material's impact plays beside it). */
const knock = (o: { clickF: number; click: number; tones: readonly (readonly [number, number, number])[] }): ((take: Take) => Layer[]) => (take) => [
  sceneNoise({ type: 'bandpass', f: o.clickF * take.f, q: 1.5, d: 0.018, vol: o.click * take.v }),
  ...o.tones.map(([f, d, vol]) => sceneTone({ f: f * take.f, d: d * take.t, vol: vol * take.v })),
]

const voice = (o: { f0: number; f1: number; d: number; fA: number; fB: number; noise: number; vol: number }): ((take: Take) => Layer[]) => (take) => [
  sceneVoice({ f0: o.f0 * take.f, f1: o.f1 * take.f, d: o.d * take.t, fA: o.fA * take.f, fB: o.fB * take.f, noise: o.noise, vol: o.vol * take.v }),
]

const BODY: Readonly<Record<BodySoundId, (take: Take) => Layer[]>> = {
  jump: (take) => [
    sceneNoise({ type: 'bandpass', f: 900 * take.f, f2: 1700 * take.f, q: 1, a: 0.03, d: 0.12, vol: 0.18 * take.v }),
    sceneNoise({ type: 'bandpass', f: 2200 * take.f, q: 0.8, d: 0.04, vol: 0.12 * take.v }),
    sceneTone({ f: 85 * take.f, f2: 60, d: 0.04, vol: 0.2 * take.v }),
  ],
  cloth_rustle: (take) => [
    { ...sceneNoise({ type: 'bandpass', f: 2400 * take.f, q: 0.8, a: 0.06, d: 0.22 * take.t, vol: 0.12 * take.v }), modulators: [{ target: 'gain', wave: 'triangle', rate: [9, 14], depth: 0.5 }] },
  ],
  body_fall: (take) => [
    sceneTone({ f: 58 * take.f, f2: 35, d: 0.28 * take.t, vol: 0.9 * take.v }),
    sceneNoise({ type: 'lowpass', f: 480 * take.f, d: 0.3 * take.t, vol: 0.55 * take.v }),
    sceneNoise({ type: 'bandpass', f: 1300 * take.f, q: 1, d: 0.05, vol: 0.3 * take.v }),
    // the limbs a moment later, and the clothes
    sceneTone({ f: 75 * take.f, f2: 45, d: 0.12, vol: 0.4 * take.v, delay: 0.13 * take.t }),
    sceneNoise({ type: 'bandpass', f: 2200, q: 0.8, d: 0.2, vol: 0.12 * take.v, delay: 0.05 }),
  ],
  fall_damage: (take) => [
    ...BODY.body_fall(take),
    sceneNoise({ type: 'highpass', f: 2800, d: 0.02, vol: 0.35 * take.v, delay: 0.01 }),
    ...voice({ f0: 170, f1: 110, d: 0.32, fA: 650, fB: 1150, noise: 0.25, vol: 0.32 })(take).map((layer) => ({ ...layer, at: 0.08 })),
  ],
  player_hurt: voice({ f0: 150, f1: 105, d: 0.26, fA: 620, fB: 1100, noise: 0.3, vol: 0.35 }),
  player_breath_run: (take) => [
    sceneNoise({ type: 'bandpass', f: 1200 * take.f, q: 1, a: 0.08, d: 0.22 * take.t, vol: 0.25 * take.v }),
    sceneNoise({ type: 'bandpass', f: 900 * take.f, q: 1, a: 0.06, d: 0.26 * take.t, vol: 0.3 * take.v, delay: 0.3 * take.t }),
  ],
  player_death: voice({ f0: 135, f1: 68, d: 1, fA: 560, fB: 980, noise: 0.35, vol: 0.4 }),
  bite: (take) => [
    sceneNoise({ type: 'highpass', f: 2600, d: 0.015, vol: 0.4 * take.v }),
    sceneNoise({ type: 'bandpass', f: 1600 * take.f, f2: 450, q: 2.2, d: 0.16 * take.t, vol: 0.55 * take.v, delay: 0.01 }),
    sceneNoise({ type: 'bandpass', f: 3200 * take.f, f2: 1800, q: 1.2, d: 0.22 * take.t, vol: 0.25 * take.v, delay: 0.09 }),
    sceneTone({ f: 120 * take.f, f2: 70, d: 0.06, vol: 0.3 * take.v }),
  ],
  grab: (take) => [
    sceneNoise({ type: 'bandpass', f: 1900 * take.f, q: 0.9, a: 0.004, d: 0.13 * take.t, vol: 0.32 * take.v }),
    sceneTone({ f: 95 * take.f, f2: 60, d: 0.07, vol: 0.3 * take.v }),
    sceneNoise({ type: 'lowpass', f: 700, d: 0.08, vol: 0.2 * take.v }),
  ],
  punch_swing: whoosh('punch', 450, 1500, 0.16, 0.9),
  punch_hit_body: fleshHit({ slap: 0.55, slapF: 1500, thud: 0.6, thudF: 115, thudD: 0.09 }),
  punch_hit_face: fleshHit({ slap: 0.75, slapF: 2300, thud: 0.45, thudF: 150, thudD: 0.07, crack: 0.25 }),
  punch_hit_object: knock({ clickF: 1800, click: 0.3, tones: [[210, 0.04, 0.25]] }),
  kick_swing: whoosh('kick', 280, 950, 0.22, 1, 1.3),
  kick_hit: fleshHit({ slap: 0.45, slapF: 1100, thud: 0.85, thudF: 82, thudD: 0.14 }),
  kick_hit_object: knock({ clickF: 1000, click: 0.3, tones: [[92, 0.08, 0.5]] }),
  shove_two_hands: (take) => [
    sceneNoise({ type: 'bandpass', f: 950 * take.f, q: 0.9, a: 0.01, d: 0.13 * take.t, vol: 0.38 * take.v }),
    sceneTone({ f: 100 * take.f, f2: 60, d: 0.1 * take.t, vol: 0.45 * take.v }),
    sceneNoise({ type: 'bandpass', f: 2300, q: 0.8, d: 0.16, vol: 0.12 * take.v, delay: 0.03 }),
  ],
  knife_swing: whoosh('blade', 1900, 4600, 0.12, 1.1, 2.2),
  knife_stab: fleshHit({ slap: 0.2, slapF: 1200, thud: 0.4, thudF: 160, thudD: 0.06, wet: 0.5 }),
  knife_slash: (take) => [
    sceneNoise({ type: 'highpass', f: 3200 * take.f, f2: 1800, d: 0.13 * take.t, vol: 0.35 * take.v }),
    sceneNoise({ type: 'bandpass', f: 1300 * take.f, f2: 600, q: 2.5, d: 0.12 * take.t, vol: 0.35 * take.v, delay: 0.02 }),
  ],
  knife_hit_object: knock({ clickF: 3200, click: 0.25, tones: [[2800, 0.08, 0.07], [4150, 0.06, 0.05]] }),
  blunt_swing: whoosh('blunt', 220, 760, 0.28, 1.1, 1.5),
  blunt_hit: fleshHit({ slap: 0.35, slapF: 900, thud: 1, thudF: 70, thudD: 0.18, crack: 0.3 }),
  blunt_hit_object: knock({ clickF: 1400, click: 0.35, tones: [[300, 0.12, 0.25], [760, 0.08, 0.12]] }),
  axe_swing: whoosh('chop', 190, 620, 0.3, 1.2, 1.4),
  axe_chop: fleshHit({ slap: 0.3, slapF: 1400, thud: 0.75, thudF: 140, thudD: 0.1, crack: 0.35, wet: 0.45 }),
  axe_hit_object: knock({ clickF: 2200, click: 0.4, tones: [[1500, 0.15, 0.1], [2300, 0.1, 0.06], [140, 0.1, 0.35]] }),
}

const BODY_BUS: Partial<Record<BodySoundId, SoundRecipe['bus']>> = { player_hurt: 'voices', player_death: 'voices', player_breath_run: 'voices', fall_damage: 'voices' }

const built = [
  ...SURFACE_IDS.flatMap((surface) => GAIT_IDS.map((gait) => footstep(surface, gait))),
  ...SURFACE_IDS.flatMap((surface) => LANDING_IDS.map((l) => landing(surface, l))),
  ...BODY_SOUND_IDS.map((id) => takes(id, BODY[id], BODY_FALLOFF, id.endsWith('_swing') ? [0.94, 1.06] : [0.96, 1.04], BODY_BUS[id])),
]

/**
 * Every body sound of `game-contracts`' `BODY_FOLEY_IDS` as a set of four takes (`footstep_concrete_walk` plays `footstep_concrete_walk_01`..`_04`,
 * never the same twice in a row, at ±4% of rate). Register it in the engine the body plays on.
 */
export const BODY_FOLEY_BANK: SoundBank = {
  id: 'body_foley',
  sounds: built.flatMap((entry) => entry.sounds),
  sets: built.map((entry) => entry.set),
}

/** The ids the bank answers (the sets), in the contract's order. */
export const BODY_FOLEY_SET_IDS: readonly string[] = [...FOOTSTEP_SOUND_IDS, ...LAND_SOUND_IDS, ...BODY_SOUND_IDS]
