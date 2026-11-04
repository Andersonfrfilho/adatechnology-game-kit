import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SFX_CATALOG, createSoundRegistry, kitSampleBank, loadUserSamples, soundSourceOf, userSampleBank } from '../src/index'
import type { SfxManifest, SoundBank, UserSfxManifest, UserSoundPicks } from '../src/index'

const take = (file: string) => ({ file, sampleRate: 48000, channels: 1, peak: -1, seconds: 0.5, source: `pack/${file}`, author: 'Valve', license: 'Valve, sem licença' })

const userManifest: UserSfxManifest = {
  version: 1,
  sounds: [
    { id: 'smg_9mm_auto', category: 'armas', role: 'primary', label: 'SMG', layers: { close: [take('armas/smg_9mm_auto_01.ogg'), take('armas/smg_9mm_auto_02.ogg')] } },
    { id: 'pistol_9mm', category: 'armas', role: 'fallback', label: '9 mm', layers: { close: [take('armas/pistol_9mm_01.ogg')] } },
    { id: 'mag_seat_medium', category: 'armas', role: 'fallback', label: 'mag', layers: { close: [take('armas/mag_seat_medium_01.ogg')] } },
    { id: 'zombie_attack', category: 'personagem', role: 'primary', label: 'zumbi', layers: { close: [take('personagem/zombie_attack_01.ogg')] } },
  ],
}

const kitManifest: SfxManifest = {
  version: 1,
  format: { codec: 'vorbis', sampleRate: 48000, channels: 1, peakDb: -1 },
  sounds: [
    { id: 'pistol_9mm', category: 'armas', layers: { close: [{ ...take('armas/pistol_9mm_01.ogg'), author: 'kit', license: 'CC0' }] } },
    { id: 'mag_seat_medium', category: 'armas', layers: { close: [{ ...take('armas/mag_seat_medium_01.ogg'), author: 'kit', license: 'CC0' }] } },
  ],
}

describe('the owner sounds', () => {
  it('play where the kit has no recording and stay behind the kit where it has one', () => {
    const registry = createSoundRegistry([kitSampleBank(kitManifest, { aliases: {} })])
    const result = userSampleBank(userManifest, { baseUrl: './sfx-local/', kitHas: (id) => Boolean(registry.sample(id)) })
    registry.register(result.bank)
    expect([...result.playing].sort()).toEqual(['smg_9mm_auto', 'zombie_attack'])
    expect([...result.behindKit].sort()).toEqual(['mag_seat', 'pistol_9mm'])
    expect(registry.bankOf('pistol_9mm')).toBe('kit_samples')
    expect(registry.bankOf('mag_seat')).toBe('kit_samples')
    expect(registry.bankOf('smg_9mm_auto')).toBe('user_samples')
    expect(registry.sample('smg_9mm_auto')?.close.map((ref) => ref.url)).toEqual(['./sfx-local/armas/smg_9mm_auto_01.ogg', './sfx-local/armas/smg_9mm_auto_02.ogg'])
    // every pick can still be heard on its own
    expect(registry.sample('user:pistol_9mm')?.close[0]?.url).toBe('./sfx-local/armas/pistol_9mm_01.ogg')
    expect(registry.sample('zombie_attack')?.bus).toBe('voices')
  })

  it('fill in for the kit when its files are not there', () => {
    const result = userSampleBank(userManifest, { kitHas: () => false })
    expect([...result.playing].sort()).toEqual(['mag_seat', 'pistol_9mm', 'smg_9mm_auto', 'zombie_attack'])
  })

  it('load after the kit and change nothing without the folder', async () => {
    const banks: SoundBank[] = []
    const registry = createSoundRegistry([kitSampleBank(kitManifest, { aliases: {} })])
    const engine = { register: (bank: SoundBank) => void banks.push(bank), registry }
    expect(await loadUserSamples(engine, { fetchManifest: () => Promise.reject(new Error('404')) })).toBeNull()
    expect(banks).toHaveLength(0)
    const loaded = await loadUserSamples(engine, { fetchManifest: () => Promise.resolve(userManifest) })
    expect(loaded?.behindKit).toContain('pistol_9mm')
    expect(banks).toHaveLength(1)
  })

  it('name where a voice came from', () => {
    expect(soundSourceOf({ kind: 'recipe', bank: 'game_sfx' })).toBe('synth')
    expect(soundSourceOf({ kind: 'sample', bank: 'kit_samples' })).toBe('sdk')
    expect(soundSourceOf({ kind: 'sample', bank: 'user_samples' })).toBe('user')
  })

  it('pick only files, no audio, each primary pick a sound the panel lists', () => {
    const picks = JSON.parse(readFileSync(join(__dirname, '../user-sounds/picks.json'), 'utf8')) as UserSoundPicks
    const catalogue = new Set(SFX_CATALOG.map((entry) => entry.id))
    for (const pick of picks.picks) {
      expect(pick.files.length, pick.id).toBeGreaterThan(0)
      expect(pick.files.every((file) => file.endsWith('.wav')), pick.id).toBe(true)
      if (pick.role === 'primary') expect(catalogue.has(pick.id), pick.id).toBe(true)
    }
  })
})
