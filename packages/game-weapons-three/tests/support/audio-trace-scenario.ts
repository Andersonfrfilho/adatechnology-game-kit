import { createAudioRecorder } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { CALIBERS } from '@adatechnology/game-weapons'
import type { CaliberDef, ReloadStageId } from '@adatechnology/game-weapons'

import { createWeaponAudio, GAME_SOUND_CLASSES, MECHANICAL_SOUNDS } from '../../src'
import type { MechanicalSoundId, WeaponAudioOptions } from '../../src'

export type AudioTraceCase = {
  readonly id: string
  readonly seed: number
  /** `currentTime` of the fake context, so a call that forgets to add it shows up. */
  readonly currentTime: number
  readonly options?: Omit<WeaponAudioOptions, 'seed' | 'createContext'>
}

export const AUDIO_TRACE_CASES: readonly AudioTraceCase[] = [
  { id: 'defaults-seed-1', seed: 1, currentTime: 0 },
  { id: 'defaults-seed-7-late-clock', seed: 7, currentTime: 2.5 },
  {
    id: 'custom-options-seed-3',
    seed: 3,
    currentTime: 0,
    options: {
      classes: { thump: [300, 0.7, 0.2] },
      distance: { gainFalloff: 0.01 },
      mechanical: { dry_fire: [{ layer: 'metal', at: 0, frequency: 2000, gain: 0.3 }, { layer: 'class', at: 0.05, soundClass: 'impact', volume: 0.5 }] },
    },
  },
]

const caliberOf = (id: string): CaliberDef => {
  const found = CALIBERS.find((caliber) => caliber.id === id)
  if (!found) throw new Error(`caliber ${id}`)
  return found
}

const RELOAD_CATEGORIES = ['pistol', 'shotgun', 'revolver', 'rifle'] as const
const CLASS_DISTANCES = [0, 10, 60, 120] as const

/**
 * The same calls as `audio.test.ts` (a shot, a reload stage, an empty click, a clink, a class at a distance) plus everything else `createWeaponAudio`
 * can play: shots of every class with and without suppressor and closed room, every mechanical sound, every game class at four distances, the
 * reload helpers, the cycle, clinks, the thud, a volume change, a dispose and a sound after it.
 */
export function playWeaponAudioScenario(testCase: AudioTraceCase): AudioTrace {
  const recorder = createAudioRecorder({ currentTime: testCase.currentTime })
  const audio = createWeaponAudio(0.6, { ...testCase.options, seed: testCase.seed, createContext: () => recorder.context })

  audio.shot(500, 'pistol', { distance: 20 })
  audio.event({ type: 'reload_stage', stage: 'magazine_out' as ReloadStageId, at: 0 })
  audio.event({ type: 'empty', at: 0 })
  audio.clink()
  audio.play('glass', 1, 10)

  audio.shot(500, 'pistol')
  audio.shot(0, 'pistol', { caliber: caliberOf('9x19'), distance: 5 })
  audio.shot(0, 'shotgun', { caliber: caliberOf('12ga_00buck'), distance: 12 })
  audio.shot(0, 'rifle', { caliber: caliberOf('7_62x39'), distance: 40 })
  audio.shot(0, 'rifle', { caliber: caliberOf('7_62x51'), distance: 0, volume: 0.5 })
  audio.shot(12000, 'sniper', { distance: 0 })
  audio.shot(1800, 'rifle', { distance: 3, suppressed: true })
  audio.shot(1800, 'rifle', { distance: 3, indoors: true })
  audio.shot(500, 'pistol', { distance: 500 })

  for (const id of Object.keys(MECHANICAL_SOUNDS) as MechanicalSoundId[]) audio.mechanical(id)
  for (const soundClass of [...Object.keys(GAME_SOUND_CLASSES), 'thump', 'unknown_class']) for (const distance of CLASS_DISTANCES) audio.play(soundClass, 1, distance)
  audio.play('pistol', 0.4, 7)

  audio.click()
  audio.cycle()
  for (const category of RELOAD_CATEGORIES) {
    audio.reloadStart(category)
    audio.reloadEnd(category)
  }
  audio.clink()
  audio.clink()
  audio.thud()

  audio.setVolume(0.3)
  audio.shot(500, 'pistol', { distance: 1 })
  audio.dispose()
  audio.shot(500, 'pistol', { distance: 2 })
  audio.dispose()
  return recorder.trace()
}
