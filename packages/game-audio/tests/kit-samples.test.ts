import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { KIT_SAMPLE_ALIASES, createSoundRegistry, kitSampleBank, loadKitSamples } from '../src'
import type { SfxManifest, SoundBank } from '../src'

const manifest = JSON.parse(readFileSync(join(__dirname, '../assets/sfx/manifest.json'), 'utf8')) as SfxManifest

describe('kit samples', () => {
  it('every file of the kit has an SDK licence and a source', () => {
    const files = manifest.sounds.flatMap((sound) => Object.values(sound.layers).flatMap((entries) => entries ?? []))
    expect(files.length).toBeGreaterThan(500)
    for (const file of files) {
      expect(['CC0', 'CC-BY']).toContain(file.license)
      expect(file.source).toMatch(/^https:\/\//)
    }
  })

  it('a recipe id named in the aliases plays the takes of its file id', () => {
    const bank = kitSampleBank(manifest, { baseUrl: './sfx/' })
    const byId = new Map((bank.samples ?? []).map((sound) => [sound.id, sound]))
    for (const [alias, target] of Object.entries(KIT_SAMPLE_ALIASES)) {
      const sound = byId.get(alias)
      expect(sound, alias).toBeDefined()
      expect(sound?.close.map((ref) => ref.url)).toEqual(byId.get(target)?.close.map((ref) => ref.url))
      expect(sound?.close[0]?.url.startsWith('./sfx/')).toBe(true)
    }
  })

  it('voices go on the voices bus, ambience on ambience, the rest in the world', () => {
    const bank = kitSampleBank(manifest)
    const bus = (id: string) => bank.samples?.find((sound) => sound.id === id)?.bus
    expect(bus('player_hurt_male')).toBe('voices')
    expect(bus('ambience_city_day')).toBe('ambience')
    expect(bus('door_wood_shut')).toBe('world')
  })

  it('registers the bank from the fetched manifest, and gives up quietly when there is none', async () => {
    const banks: SoundBank[] = []
    const engine = { register: (bank: SoundBank) => void banks.push(bank) }
    const bank = await loadKitSamples(engine, { baseUrl: '/s/', fetchManifest: async (url) => (expect(url).toBe('/s/manifest.json'), manifest) })
    expect(bank && createSoundRegistry([bank]).sample('shut_wood')).toBeTruthy()
    expect(await loadKitSamples(engine, { fetchManifest: async () => Promise.reject(new Error('file://')) })).toBeNull()
    expect(banks).toHaveLength(1)
  })

  it('does not even ask for the manifest from a page opened from disk (the refused fetch would log a console error)', async () => {
    const fetched: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => (fetched.push(String(url)), new Response('{}'))) as typeof fetch
    try {
      expect(await loadKitSamples({ register: () => undefined }, { baseUrl: 'file:///room/sfx/' })).toBeNull()
      expect(fetched).toEqual([])
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
