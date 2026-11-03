import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SfxManifest } from '@adatechnology/game-audio'
import { BLAST_FIRE_SAMPLES, blastFireSampleBank, DESTRUCTION_SOUND_BANK } from '../src/index'

const sfx = join(dirname(fileURLToPath(import.meta.url)), '../../game-audio/assets/sfx')
const manifest = JSON.parse(readFileSync(join(sfx, 'manifest.json'), 'utf8')) as SfxManifest

describe('recorded blasts and fire', () => {
  const bank = blastFireSampleBank(manifest, { baseUrl: '' })
  const samples = new Map((bank.samples ?? []).map((sample) => [sample.id, sample]))

  it('every id of the table has recorded takes in the kit manifest, and every file is there', () => {
    for (const id of Object.keys(BLAST_FIRE_SAMPLES)) {
      const sample = samples.get(id)
      expect(sample, id).toBeDefined()
      for (const ref of sample!.close) expect(existsSync(join(sfx, ref.url)), ref.url).toBe(true)
    }
  })

  it('every recorded id keeps a synthesized recipe of the same id as its fallback', () => {
    const recipes = new Set([...(DESTRUCTION_SOUND_BANK.sounds ?? []).map((sound) => sound.id), ...(DESTRUCTION_SOUND_BANK.loops ?? []).map((loop) => loop.id)])
    for (const id of samples.keys()) expect(recipes.has(id), id).toBe(true)
  })

  it('the fire roar loops over several recorded fires; the one-shots do not loop', () => {
    const fire = samples.get('fire_loop')!
    expect(fire.loop).toBeTruthy()
    expect(fire.close.length).toBeGreaterThanOrEqual(3)
    for (const [id, sample] of samples) if (id !== 'fire_loop') expect(sample.loop, id).toBeUndefined()
  })

  it('a blast fades with distance like its recipe, and only blasts and fire are taken from the manifest', () => {
    expect(samples.get('explosion_grenade')!.falloff).toEqual((DESTRUCTION_SOUND_BANK.sounds ?? []).find((sound) => sound.id === 'explosion_grenade')!.falloff)
    expect([...samples.keys()].sort()).toEqual(Object.keys(BLAST_FIRE_SAMPLES).sort())
  })
})
