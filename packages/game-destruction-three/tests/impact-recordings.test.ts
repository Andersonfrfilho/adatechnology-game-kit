import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { kitSampleBank } from '@adatechnology/game-audio'
import type { SfxManifest } from '@adatechnology/game-audio'
import { DESTRUCTION_SOUND_BANK, DESTRUCTION_SOUND_KEYS } from '../src'

const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../game-audio/assets/sfx/manifest.json'), 'utf8')) as SfxManifest
const samples = new Map((kitSampleBank(manifest).samples ?? []).map((sample) => [sample.id, sample]))
const recipes = new Set((DESTRUCTION_SOUND_BANK.sounds ?? []).map((sound) => sound.id))
const rules = DESTRUCTION_SOUND_KEYS.art_scene

describe('the recorded wood, metal and cloth impacts', () => {
  it('each sound answers several takes, so a repeated blow does not repeat', () => {
    for (const id of ['wood_blade', 'clang', 'metal_blade', 'metal_ping', 'fabric_rip']) expect(samples.get(id)?.close.length, id).toBeGreaterThanOrEqual(4)
  })

  it('wood splinters and cloth thumps have a light, a medium and a heavy tier of their own takes', () => {
    for (const id of ['wood_splinter', 'fabric_hit']) {
      const tiers = samples.get(id)?.tiers ?? []
      expect(tiers.map((tier) => tier.name), id).toEqual(['light', 'medium', 'heavy'])
      for (const tier of tiers) expect(tier.close.length, `${id} ${tier.name}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('the keys of the materials play them, and each keeps a synthesized recipe of the same id for the time the file decodes', () => {
    const wanted: Record<string, string> = {
      impact_wood_slash: 'wood_blade',
      break_wood: 'wood_splinter',
      splinter: 'wood_splinter',
      shot_wood: 'wood_splinter',
      impact_metal: 'clang',
      impact_metal_slash: 'metal_blade',
      shot_metal: 'metal_ping',
      impact_soft_blunt: 'fabric_hit',
      impact_soft_slash: 'fabric_rip',
      break_fabric: 'fabric_rip',
    }
    for (const [key, id] of Object.entries(wanted)) {
      expect(rules[key]?.sound, key).toBe(id)
      expect(samples.has(id), id).toBe(true)
      expect(recipes.has(id), id).toBe(true)
    }
  })
})
