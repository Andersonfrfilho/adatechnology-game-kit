import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CALIBRATION_SOUND, balanceOf, calibrationLoader, centroidHz, countHits, dbOf, encodeWav, endDropDb, onsetIndex, peakOf, ringSeconds, rmsDb, sampleUrls } from '../src'
// @ts-expect-error a checked JS script without a declaration file
import { normalizeLicense, parseCredits } from '../scripts/sfx-convert.mjs'

const RATE = 48000
const tone = (hz: number, seconds: number, gain = 0.5, startAt = 0): Float32Array => {
  const samples = new Float32Array(Math.round(seconds * RATE))
  for (let index = Math.round(startAt * RATE); index < samples.length; index++) samples[index] = gain * Math.sin((2 * Math.PI * hz * index) / RATE)
  return samples
}

describe('the analysis of rendered sound', () => {
  it('finds the onset, the peak and the RMS', () => {
    const samples = tone(440, 0.5, 0.5, 0.1)
    expect(onsetIndex([samples], 0, 0.001)).toBeGreaterThanOrEqual(Math.round(0.1 * RATE))
    expect(onsetIndex([samples], 0, 0.001)).toBeLessThan(Math.round(0.1 * RATE) + 10)
    expect(dbOf(peakOf([samples]))).toBeCloseTo(-6.02, 1)
    expect(rmsDb([samples], 0.2 * RATE, 0.4 * RATE)).toBeCloseTo(-9.03, 1)
  })

  it('a brighter tone has a higher centroid', () => {
    expect(centroidHz([tone(4000, 0.1)], RATE, 0)).toBeGreaterThan(centroidHz([tone(300, 0.1)], RATE, 0) * 4)
  })

  it('tells the side and counts the hits of a burst', () => {
    const quiet = new Float32Array(RATE / 10)
    expect(balanceOf(quiet, tone(440, 0.1), 0, quiet.length)).toBeCloseTo(1)
    const burst = new Float32Array(RATE)
    for (let hit = 0; hit < 8; hit++) for (let index = 0; index < 600; index++) burst[hit * 4800 + index] = 0.8 * Math.exp(-index / 120)
    expect(countHits([burst], RATE, 0.3)).toBe(8)
  })

  it('measures how long a sound rings and whether it ends on a cut', () => {
    const decay = new Float32Array(RATE)
    for (let index = 0; index < decay.length; index++) decay[index] = Math.exp(-index / (0.1 * RATE)) * Math.sin(index / 5)
    expect(ringSeconds([decay], RATE, 0, -60)).toBeGreaterThan(0.6)
    expect(ringSeconds([decay], RATE, 0, -60)).toBeLessThan(0.8)
    expect(endDropDb([tone(200, 0.2)], RATE)).toBeGreaterThan(-3)
    expect(endDropDb([decay], RATE)).toBeLessThan(-40)
  })
})

describe('the calibration sound', () => {
  it('has every layer the criteria ask for, and its takes start on the first sample and fade out', async () => {
    expect(CALIBRATION_SOUND.close.length).toBeGreaterThanOrEqual(4)
    expect(CALIBRATION_SOUND.far?.length).toBeGreaterThan(0)
    expect(CALIBRATION_SOUND.tiers?.map((tier) => tier.name)).toEqual(['light', 'medium', 'heavy'])
    const loader = calibrationLoader()
    for (const url of sampleUrls(CALIBRATION_SOUND)) {
      const bytes = new DataView(await loader(url))
      expect(String.fromCharCode(bytes.getUint8(0), bytes.getUint8(1), bytes.getUint8(2), bytes.getUint8(3))).toBe('RIFF')
      expect(bytes.getUint32(24, true)).toBe(48000)
      const samples = new Float32Array((bytes.byteLength - 44) / 2)
      for (let index = 0; index < samples.length; index++) samples[index] = bytes.getInt16(44 + index * 2, true) / 0x8000
      expect(dbOf(peakOf([samples]))).toBeLessThanOrEqual(0)
      expect(endDropDb([samples], 48000)).toBeLessThan(-40)
    }
    await expect(loader('elsewhere.ogg')).rejects.toThrow()
  })

  it('encodes a WAV header for the length given', () => {
    const bytes = encodeWav(new Float32Array(100))
    expect(bytes.byteLength).toBe(244)
  })
})

describe('the converter of the inbox', () => {
  it('accepts only CC0 and CC-BY in the SDK, Sonniss and Pixabay only in a game', () => {
    expect(normalizeLicense('CC0')).toBe('CC0')
    expect(normalizeLicense('Creative Commons 0')).toBe('CC0')
    expect(normalizeLicense('CC-BY 4.0')).toBe('CC-BY')
    expect(normalizeLicense('Attribution 3.0')).toBe('CC-BY')
    expect(normalizeLicense('CC BY-NC 4.0')).toBeNull()
    expect(normalizeLicense('CC-BY-SA')).toBeNull()
    expect(normalizeLicense('Sonniss GDC')).toBe('Sonniss')
    expect(normalizeLicense('Pixabay License')).toBe('Pixabay')
    expect(normalizeLicense('')).toBeNull()
  })

  it('reads the credit lines and skips the header', () => {
    const credits = parseCredits('| arquivo | link | autor | licença |\n|---|---|---|---|\n| pistol_9mm_close_01.wav | https://freesound.org/s/1 | fulano | CC0 |\nsolto\n')
    expect([...credits.keys()]).toEqual(['pistol_9mm_close_01.wav'])
    expect(credits.get('pistol_9mm_close_01.wav')?.author).toBe('fulano')
  })

  const hasFfmpeg = (() => {
    try {
      execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  it.skipIf(!hasFfmpeg)('converts a stereo 44.1 kHz WAV with silence in front to mono 48 kHz ogg at −1 dBFS, with manifest and credits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sfx-'))
    const inbox = join(dir, 'inbox')
    const out = join(dir, 'out')
    mkdirSync(join(inbox, 'armas'), { recursive: true })
    // 0.2 s of silence, then a 0.3 s decaying tone at −12 dBFS, stereo 44.1 kHz
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=if(lt(t\\,0.2)\\,0\\,0.25*sin(2*PI*220*t)*exp(-(t-0.2)*8)):s=44100:d=0.5', '-ac', '2', join(inbox, 'armas', 'test_shot_close_01.wav')])
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=0.4:a=0.1', join(inbox, 'armas', 'test_shot_far_01.wav')])
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=0.4:a=0.1', join(inbox, 'armas', 'not_credited.wav')])
    writeFileSync(join(inbox, 'CREDITOS.md'), '| test_shot_close_01.wav | https://example.org/1 | kit | CC0 |\n| test_shot_far_01.wav | https://example.org/2 | kit | CC-BY 4.0 |\n')
    let failed = false
    try {
      execFileSync('node', [join(__dirname, '../scripts/sfx-convert.mjs'), '--inbox', inbox, '--out', out], { stdio: 'pipe' })
    } catch {
      failed = true
    }
    // the file without credits is refused (exit 1), the two credited ones are converted
    expect(failed).toBe(true)
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
    const sound = manifest.sounds.find((entry: { id: string }) => entry.id === 'test_shot')
    expect(sound.layers.close[0]).toMatchObject({ file: 'armas/test_shot_close_01.ogg', sampleRate: 48000, channels: 1, license: 'CC0' })
    expect(sound.layers.close[0].peak).toBeLessThanOrEqual(-0.95)
    expect(sound.layers.close[0].peak).toBeGreaterThan(-1.6)
    // the 0.2 s of silence in front is gone
    expect(sound.layers.close[0].seconds).toBeLessThan(0.35)
    expect(sound.layers.far[0].license).toBe('CC-BY')
    expect(readFileSync(join(out, 'CREDITOS.md'), 'utf8')).toContain('| armas/test_shot_far_01.ogg | https://example.org/2 | kit | CC-BY |')
  }, 30000)
})
