import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SfxManifest } from '@adatechnology/game-audio'
import { hasKitSfx, kitSfxDir } from '../../game-audio/scripts/sfx-dir.mjs'
import { BLAST_FIRE_SAMPLES, blastFireSampleBank, DESTRUCTION_SOUND_BANK } from '../src/index'

// the manifest (id -> path) is in the kit; the files are in the game's repository, on this machine only when it is linked (sfx-dir.mjs)
const manifestDir = join(dirname(fileURLToPath(import.meta.url)), '../../game-audio/assets/sfx')
const manifest = JSON.parse(readFileSync(join(manifestDir, 'manifest.json'), 'utf8')) as SfxManifest
const files = kitSfxDir()

describe('recorded blasts and fire', () => {
  const bank = blastFireSampleBank(manifest, { baseUrl: '' })
  const samples = new Map((bank.samples ?? []).map((sample) => [sample.id, sample]))

  it('every id of the table has recorded takes in the kit manifest', () => {
    for (const id of Object.keys(BLAST_FIRE_SAMPLES)) expect(samples.get(id), id).toBeDefined()
  })

  it.skipIf(!hasKitSfx())('every file of those takes is in the linked sound folder', () => {
    for (const id of Object.keys(BLAST_FIRE_SAMPLES)) for (const ref of samples.get(id)!.close) expect(existsSync(join(files, ref.url)), ref.url).toBe(true)
  })

  it('every recorded id keeps a synthesized recipe of the same id as its fallback', () => {
    const recipes = new Set([...(DESTRUCTION_SOUND_BANK.sounds ?? []).map((sound) => sound.id), ...(DESTRUCTION_SOUND_BANK.loops ?? []).map((loop) => loop.id)])
    for (const id of samples.keys()) expect(recipes.has(id), id).toBe(true)
  })

  it('each fuel roars over several recorded fires, crossfaded in a loop; the one-shots do not loop', () => {
    const loops = ['fire_loop', 'fire_loop_gas', 'fire_loop_liquid', 'fire_loop_plastic']
    for (const id of loops) {
      const fire = samples.get(id)!
      expect(fire.loop, id).toBeTruthy()
      expect(fire.close.length, id).toBeGreaterThanOrEqual(3)
    }
    // a smoke canister hisses for a minute over two takes of gas, chained the same way
    expect(samples.get('smoke_grenade_hiss')!.loop).toBeTruthy()
    expect(samples.get('smoke_grenade_hiss')!.close.length).toBeGreaterThanOrEqual(2)
    for (const [id, sample] of samples) if (![...loops, 'smoke_grenade_hiss'].includes(id)) expect(sample.loop, id).toBeUndefined()
  })

  it('a blast fades with distance like its recipe, and only blasts and fire are taken from the manifest', () => {
    expect(samples.get('explosion_grenade')!.falloff).toEqual((DESTRUCTION_SOUND_BANK.sounds ?? []).find((sound) => sound.id === 'explosion_grenade')!.falloff)
    expect([...samples.keys()].sort()).toEqual(Object.keys(BLAST_FIRE_SAMPLES).sort())
  })
})
