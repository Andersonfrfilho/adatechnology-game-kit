// A spent case must land far under the shot that ejected it (a rifle is 155-165 dB SPL at the muzzle, a brass case on concrete 60-75 dB at a metre), and
// a burst must not leave one voice ringing per round. Levels are planned from the recorded peaks of the manifest and the gain each sound plays with.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kitSampleBank, kitSampleDefaults } from '@adatechnology/game-audio'
import type { SampleDefaults, SfxManifest } from '@adatechnology/game-audio'

import { GUNSHOT_SAMPLE_IDS, weaponSampleBank, weaponSampleDefaults } from '../src/audio'

const manifest = JSON.parse(readFileSync(join(__dirname, '../../game-audio/assets/sfx/manifest.json'), 'utf8')) as SfxManifest
const MIN_DB_UNDER_SHOT = 30
/** A suppressed shot is itself played 5 dB under the open one. */
const MIN_DB_UNDER_SUPPRESSED_SHOT = 25
const MAX_CASING_VOICES = 4

const peakDb = (id: string, pick: (peaks: number[]) => number): number => {
  const sound = manifest.sounds.find((entry) => entry.id === id)
  const peaks = (sound?.layers.close ?? []).map((file) => file.peak)
  if (peaks.length === 0) throw new Error(`no recording for ${id}`)
  return pick(peaks)
}
const levelDb = (defaults: SampleDefaults | undefined, recordedPeakDb: number): number => recordedPeakDb + 20 * Math.log10(defaults?.gain ?? 1)

const casingIds = manifest.sounds.map((sound) => sound.id).filter((id) => id.startsWith('casing_drop_'))
const shotIds = GUNSHOT_SAMPLE_IDS.filter((id) => manifest.sounds.some((sound) => sound.id === id))
const armas = (id: string) => ({ id, category: 'armas' })

describe('spent case level', () => {
  it('the manifest has the recorded cases and shots to compare', () => {
    expect(casingIds.length).toBeGreaterThanOrEqual(3)
    expect(shotIds.length).toBeGreaterThanOrEqual(5)
  })

  it.each([
    ['the weapons bank', (id: string) => weaponSampleDefaults(armas(id))],
    ['the kit bank the test room loads', (id: string) => kitSampleDefaults(armas(id))],
  ])('%s: every case plays at least 30 dB under every shot (25 under a suppressed one)', (_name, defaultsOf) => {
    for (const casing of casingIds) {
      const casingDb = levelDb(defaultsOf(casing), peakDb(casing, (peaks) => Math.max(...peaks)))
      for (const shot of shotIds) {
        const shotDb = levelDb(defaultsOf(shot), peakDb(shot, (peaks) => Math.min(...peaks)))
        expect(shotDb - casingDb, `${casing} against ${shot}`).toBeGreaterThanOrEqual(shot.startsWith('suppressed_') ? MIN_DB_UNDER_SUPPRESSED_SHOT : MIN_DB_UNDER_SHOT)
      }
    }
  })

  it('a dropped magazine is under the shot too', () => {
    const magazines = manifest.sounds.map((sound) => sound.id).filter((id) => id.startsWith('mag_drop_'))
    for (const magazine of magazines) {
      const magazineDb = levelDb(kitSampleDefaults(armas(magazine)), peakDb(magazine, (peaks) => Math.max(...peaks)))
      for (const shot of shotIds) expect(peakDb(shot, (peaks) => Math.min(...peaks)) - magazineDb, `${magazine} against ${shot}`).toBeGreaterThanOrEqual(20)
    }
  })

  it('the numbers are data, and both banks give the same ones', () => {
    for (const casing of casingIds) expect(weaponSampleDefaults(armas(casing))).toEqual(kitSampleDefaults(armas(casing)))
  })
})

describe('casing voices', () => {
  it('every case sound of both banks is capped to a few voices ringing at once', () => {
    const banks = [kitSampleBank(manifest), weaponSampleBank({ manifest })]
    for (const bank of banks) {
      const cases = (bank.samples ?? []).filter((sample) => sample.id.startsWith('casing_drop_'))
      expect(cases.length).toBeGreaterThanOrEqual(3)
      for (const sample of cases) {
        expect(sample.choke, sample.id).toBeDefined()
        expect(sample.choke?.voices ?? Infinity, sample.id).toBeLessThanOrEqual(MAX_CASING_VOICES)
      }
    }
  })

  it('keeps the variation: several takes and a pitch spread', () => {
    for (const sample of (kitSampleBank(manifest).samples ?? []).filter((entry) => entry.id.startsWith('casing_drop_'))) {
      expect(sample.close.length, sample.id).toBeGreaterThanOrEqual(3)
      expect(sample.pitch ?? 0, sample.id).toBeGreaterThan(0)
    }
  })
})
