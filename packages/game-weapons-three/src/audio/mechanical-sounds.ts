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

const metal = (at: number, frequency: number, gain: number): SoundStep => ({ layer: 'metal', at, frequency, gain })
const sound = (at: number, soundClass: keyof typeof GAME_SOUND_CLASSES, volume: number): SoundStep => ({ layer: 'class', at, soundClass, volume })
const thud = (at: number, gain: number, frequency: number): SoundStep => ({ layer: 'thud', at, gain, frequency })

const slide = [metal(0, 900, 0.35), metal(0.14, 1300, 0.35)]
const seat = [metal(0, 1100, 0.45), sound(0, 'reload', 0.8)]

/**
 * Sounds keyed by the rule: the `reload_stage` ids of `RELOAD_STAGES`, plus the other weapon events. The click of an empty weapon and the generic
 * reload tick are the game's `vazio` and `recarga` classes (jogo.js L62101-L62104; played at L68644-L68662); the gallery (sources/armas-itens__galeria-3d-arsenal.js)
 * has no sound, so the metal layers are the SDK synth (the same `metal` used since the first version).
 */
export const MECHANICAL_SOUNDS: Readonly<Record<MechanicalSoundId, readonly SoundStep[]>> = {
  dry_fire: [sound(0, 'empty', 1), metal(0, 2600, 0.25)],
  misfire: [sound(0, 'empty', 0.8), metal(0, 2200, 0.2)],
  feed: [metal(0, 1900, 0.2)],
  cycle: [metal(0.22, 900, 0.35), metal(0.36, 1300, 0.35)],
  mode: [metal(0, 2000, 0.15)],
  safety_on: [metal(0, 2200, 0.22)],
  safety_off: [metal(0, 1800, 0.22)],
  jam: [metal(0, 700, 0.4), metal(0.08, 500, 0.35)],
  clear_start: [metal(0, 1000, 0.3)],
  clear_end: [metal(0, 1300, 0.35)],
  magazine_out: [metal(0, 1500, 0.35), sound(0, 'reload', 0.6)],
  magazine_in: seat,
  charge: slide,
  bolt_open: [metal(0, 900, 0.35)],
  round_in: [metal(0, 2000, 0.2), sound(0, 'reload', 0.6)],
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
    default:
      return undefined
  }
}
