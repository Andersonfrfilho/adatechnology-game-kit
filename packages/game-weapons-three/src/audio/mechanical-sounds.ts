import type { ReloadStageId, WeaponEvent } from '@adatechnology/game-weapons'

import type { GAME_SOUND_CLASSES } from './shot-sound'

/** One layer of a mechanical sound; `at` is seconds after the start. */
export type SoundStep =
  /** Metal click: a short high noise plus a square tone at 0.6 × the frequency (the SDK synth, as before). */
  | { readonly layer: 'metal'; readonly at: number; readonly frequency: number; readonly gain: number }
  /** A sound class of the game (`recarga`, `vazio`...) played at a volume. */
  | { readonly layer: 'class'; readonly at: number; readonly soundClass: keyof typeof GAME_SOUND_CLASSES; readonly volume: number }
  /** Dull landing: lowpass noise. */
  | { readonly layer: 'thud'; readonly at: number; readonly gain: number; readonly frequency: number }
  /** The art scene's `sTone` (cena L1324): a tone sliding from `f` to `f2` (default `f`) in `d` seconds, at `vol`, `at` seconds after the start. */
  | { readonly layer: 'scene_tone'; readonly at: number; readonly wave: 'sine' | 'square'; readonly f: number; readonly f2?: number; readonly d: number; readonly vol: number }
  /** The art scene's `sNoise` (cena L1323): filtered noise, the filter sliding to `f2` when given, `d` seconds, at `vol`. */
  | { readonly layer: 'scene_noise'; readonly at: number; readonly type: 'lowpass' | 'highpass' | 'bandpass'; readonly f: number; readonly f2?: number; readonly q: number; readonly d: number; readonly vol: number }

export type MechanicalSoundId =
  | ReloadStageId
  | 'dry_fire'
  | 'misfire'
  | 'feed'
  | 'cycle'
  | 'mode'
  | 'safety_on'
  | 'safety_off'
  | 'jam'
  | 'clear_start'
  | 'clear_end'
  | 'stock_fold'
  | 'light_click'
  | 'attach'

const metal = (at: number, frequency: number, gain: number): SoundStep => ({ layer: 'metal', at, frequency, gain })
const sound = (at: number, soundClass: keyof typeof GAME_SOUND_CLASSES, volume: number): SoundStep => ({ layer: 'class', at, soundClass, volume })
const thud = (at: number, gain: number, frequency: number): SoundStep => ({ layer: 'thud', at, gain, frequency })

// The art scene's reload sounds (cena L1335-L1343). `click` is its primitive: a square tick sliding down 30 % and a short highpass noise at 0.8 of the volume.
const sceneClick = (at: number, f: number, vol: number): SoundStep[] => [
  { layer: 'scene_tone', at, wave: 'square', f, f2: f * 0.7, d: 0.02, vol },
  { layer: 'scene_noise', at, type: 'highpass', f: 3000, q: 0.7, d: 0.03, vol: vol * 0.8 },
]
const sceneNoise = (at: number, type: 'bandpass', f: number, q: number, d: number, vol: number): SoundStep => ({ layer: 'scene_noise', at, type, f, q, d, vol })
/** `sfx.empty` */
const sceneEmpty = sceneClick(0, 3200, 0.35)
/** `sfx.magOut` */
const sceneMagOut = [...sceneClick(0, 1600, 0.4), sceneNoise(0.03, 'bandpass', 900, 2, 0.08, 0.3)]
/** `sfx.magIn` */
const sceneMagIn = [...sceneClick(0, 1100, 0.5), { layer: 'scene_tone', at: 0, wave: 'sine', f: 320, f2: 200, d: 0.05, vol: 0.35 } as const]
/** `sfx.bolt` */
const sceneBolt = [...sceneClick(0, 2200, 0.4), ...sceneClick(0.12, 2700, 0.4)]
/** `sfx.shell` */
const sceneShell = [...sceneClick(0, 1400, 0.35), sceneNoise(0.02, 'bandpass', 1200, 3, 0.05, 0.25)]

const slide = [metal(0, 900, 0.35), metal(0.14, 1300, 0.35)]
const seat = [metal(0, 1100, 0.45), sound(0, 'reload', 0.8)]

/**
 * Sounds keyed by the rule: the `reload_stage` ids of `RELOAD_STAGES`, plus the other weapon events. The click of an empty weapon and the generic
 * reload tick are the game's `vazio` and `recarga` classes (jogo.js L62101-L62104; played at L68644-L68662). The Cena de Arte delivered the reload sounds
 * (`empty` -> dry_fire, `magOut` -> magazine_out, `magIn` -> magazine_in, `bolt` -> charge, `shell` -> round_in; cena L1339-L1343), so those use them; the gallery
 * (sources/armas-itens__galeria-3d-arsenal.js) has no sound, and the other metal layers are the SDK synth (the same `metal` used since the first version).
 */
export const MECHANICAL_SOUNDS: Readonly<Record<MechanicalSoundId, readonly SoundStep[]>> = {
  dry_fire: [sound(0, 'empty', 1), ...sceneEmpty],
  misfire: [sound(0, 'empty', 0.8), metal(0, 2200, 0.2)],
  feed: [metal(0, 1900, 0.2)],
  cycle: [metal(0.22, 900, 0.35), metal(0.36, 1300, 0.35)],
  mode: [metal(0, 2000, 0.15)],
  safety_on: [metal(0, 2200, 0.22)],
  safety_off: [metal(0, 1800, 0.22)],
  jam: [metal(0, 700, 0.4), metal(0.08, 500, 0.35)],
  clear_start: [metal(0, 1000, 0.3)],
  clear_end: [metal(0, 1300, 0.35)],
  stock_fold: [metal(0, 800, 0.3), metal(0.18, 1200, 0.3), thud(0.3, 0.2, 600)],
  light_click: [metal(0, 2400, 0.2), metal(0.03, 1800, 0.12)],
  attach: [metal(0, 1400, 0.35), thud(0.04, 0.2, 700), metal(0.12, 1900, 0.25)],
  magazine_out: [...sceneMagOut, sound(0, 'reload', 0.6)],
  magazine_in: [...sceneMagIn, sound(0, 'reload', 0.8)],
  charge: sceneBolt,
  bolt_open: [metal(0, 900, 0.35)],
  round_in: [...sceneShell, sound(0, 'reload', 0.6)],
  bolt_close: [metal(0, 1300, 0.35)],
  pump_cycle: slide,
  lever_cycle: [metal(0, 1000, 0.35), metal(0.12, 1500, 0.35)],
  cylinder_open: [metal(0, 1500, 0.3)],
  cylinder_eject: [metal(0, 2400, 0.25), metal(0.05, 2800, 0.2)],
  cylinder_load: [metal(0, 2000, 0.2)],
  cylinder_close: seat,
  barrels_open: [metal(0, 1000, 0.4)],
  casings_eject: [metal(0, 2600, 0.25)],
  rounds_in: [metal(0, 2000, 0.25), sound(0, 'reload', 0.6)],
  barrels_close: seat,
  cover_open: [metal(0, 800, 0.4)],
  belt_swap: [metal(0, 1400, 0.3), metal(0.08, 1800, 0.25)],
  cover_close: [metal(0, 1000, 0.45)],
  tank_swap: [thud(0, 0.4, 500), metal(0.05, 600, 0.3)],
  tube_drop: [thud(0, 0.35, 380)],
  tube_seat: seat,
  rocket_seat: [metal(0, 900, 0.45), sound(0, 'reload', 0.8)],
  breech_open: [metal(0, 1000, 0.35)],
  breech_close: seat,
}

/** Which mechanical sound a weapon event asks for, if any (`shot`, `draw` and `reload` start/end have their own handling). */
export const mechanicalSoundOf = (event: WeaponEvent): MechanicalSoundId | undefined => {
  switch (event.type) {
    case 'reload_stage':
      return event.stage
    case 'empty':
      return 'dry_fire'
    case 'misfire':
      return 'misfire'
    case 'feed':
      return 'feed'
    case 'cycle':
      return event.phase === 'start' ? 'cycle' : undefined
    case 'mode':
      return 'mode'
    case 'safety':
      return event.on ? 'safety_on' : 'safety_off'
    case 'fault':
      return 'jam'
    case 'clear':
      return event.phase === 'start' ? 'clear_start' : 'clear_end'
    case 'attachment':
      return event.action === 'break' ? 'jam' : 'attach'
    case 'toggle':
      return 'light_click'
    case 'stock':
      return 'stock_fold'
    case 'underbarrel':
      return 'mode'
    default:
      return undefined
  }
}
