import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { cutTeamAudio } from '@adatechnology/golden-tool/team-audio'

import { GAME_SFX_BANK, GAME_SFX_CLASSES, GAME_SFX_FALLBACK, LIBRARY_BANK, MIX_PROFILES, VOICE_GROUPS, createSoundRegistry, noiseClassRecipe, planSound } from '../src'

const JOGO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../specs/001-migracao-entregas-dos-times/artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js')

// the `P` table and its fallback, read from the literal cut of the game's sfx
function teamSfxTable(): { table: Record<string, [number, number, number]>; fallback: [number, number, number] } {
  const sfx = cutTeamAudio('game', readFileSync(JOGO, 'utf8')).sfx as string
  const match = /const P = (\{[\s\S]*?\})\[kind\] \|\| (\[[^\]]*\]);/.exec(sfx)
  if (!match) throw new Error('the sfx table was not found in the cut')
  return { table: new Function(`return ${match[1]}`)(), fallback: new Function(`return ${match[2]}`)() }
}

describe('shipped data', () => {
  it('game-sfx.json is the game table, row for row', () => {
    const { table, fallback } = teamSfxTable()
    expect(GAME_SFX_CLASSES.map((row) => row.team)).toEqual(Object.keys(table))
    for (const row of GAME_SFX_CLASSES) expect([row.cutoff, row.gain, row.seconds]).toEqual(table[row.team])
    expect([GAME_SFX_FALLBACK.cutoff, GAME_SFX_FALLBACK.gain, GAME_SFX_FALLBACK.seconds]).toEqual(fallback)
  })

  it('a class plans like the game: muffled cutoff, peak × attenuation, silent past 0.01', () => {
    const pistol = noiseClassRecipe(GAME_SFX_CLASSES[0] as (typeof GAME_SFX_CLASSES)[number])
    const plan = planSound(pistol, { distance: 60 })
    const attenuation = 1 / (1 + 3600 * 0.004)
    expect(plan?.layers[0]?.filters?.bank[0]?.frequency.value).toBeCloseTo(1800 / 1.6, 9)
    expect(plan?.layers[0]?.envelope).toEqual([
      { time: 0, value: 0.9 * attenuation, curve: 'set' },
      { time: 0.18, value: 0.001, curve: 'exp' },
    ])
    expect(planSound(pistol, { distance: 160 })).toBeNull()
  })

  it('every recipe, profile and group says where its numbers come from', () => {
    const recipes = [...(GAME_SFX_BANK.sounds ?? []), ...(LIBRARY_BANK.sounds ?? []), ...(LIBRARY_BANK.loops ?? [])]
    for (const recipe of recipes) expect(recipe.sources.length, recipe.id).toBeGreaterThan(0)
    for (const profile of Object.values(MIX_PROFILES)) expect(profile.sources.length).toBeGreaterThan(0)
    for (const group of Object.values(VOICE_GROUPS)) expect(group.sources?.length).toBeGreaterThan(0)
  })

  it('mix profiles carry the team chains', () => {
    expect(MIX_PROFILES.game).toMatchObject({ master: 0.5, noise: { seconds: 1.5, create: 'lazy' } })
    expect(MIX_PROFILES.art_scene).toMatchObject({ master: 0.85, compressor: { threshold: -12, ratio: 5 }, reverb: { seconds: 2.2, decay: 3.4, wet: 0.4 }, noise: { seconds: 2, create: 'eager' } })
    expect(VOICE_GROUPS.undead_voice).toMatchObject({ maxConcurrent: 5, cooldown: 0.25, maxDistance: 40 })
  })

  it('the library has the six orphan sounds and every one plans', () => {
    const registry = createSoundRegistry([GAME_SFX_BANK, LIBRARY_BANK])
    expect(registry.loopIds()).toEqual(['engine_saw', 'rotor_blades', 'crowd_rumble'])
    expect(registry.soundIds().filter((id) => !id.startsWith('sfx_'))).toEqual(['horn', 'radio_static', 'siren'])
    for (const id of registry.soundIds()) expect(planSound(registry.sound(id) as NonNullable<ReturnType<typeof registry.sound>>), id).not.toBeNull()
  })
})
