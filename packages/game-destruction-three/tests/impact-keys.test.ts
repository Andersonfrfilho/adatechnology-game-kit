import { createAudioEngine } from '@adatechnology/game-audio'
import { MATERIALS } from '@adatechnology/game-destruction'
import type { MaterialDef } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { DESTRUCTION_SOUND_BANK, DESTRUCTION_SOUND_KEYS, IMPACT_SOUND_KEYS, createDestructionSound, impactFamily, impactKey, impactSoundIds, impactSoundKeys, ricochetSoundKeys } from '../src'

// Checklist 5.3: the sound of a blow on a material follows the material and the kind of blow, not only one of five families.
const def = (id: string): MaterialDef => {
  const found = MATERIALS.find((m) => m.id === id)
  if (!found) throw new Error(`no material ${id}`)
  return found
}
const engine = createAudioEngine({ createContext: () => null })
const sound = createDestructionSound(engine)
const played = (material: string, blow?: 'ballistic' | 'blunt' | 'slash'): string | undefined => sound.rule(impactKey(def(material)), impactSoundKeys(material, def(material), blow))?.sound

describe('impact sounds by material and blow', () => {
  it('the keys go from the most specific to the family', () => {
    expect(impactSoundKeys('concrete', def('concrete'), 'ballistic').keys).toEqual(['impact_concrete_ballistic', 'impact_concrete', 'impact_masonry_ballistic', 'impact_masonry'])
    expect(impactSoundKeys('concrete', def('concrete')).keys).toEqual(['impact_concrete', 'impact_masonry'])
  })

  it('every material of the kit has a family', () => {
    for (const m of MATERIALS) expect(impactFamily(m), m.id).toBeDefined()
  })

  it('the materials the five keys put in the wrong family get their own', () => {
    expect(impactFamily(def('ceramic'))).toBe('ceramic')
    for (const id of ['soil', 'sand', 'gravel', 'turf']) expect(impactFamily(def(id)), id).toBe('soil')
    expect(impactFamily(def('plastic'))).toBe('plastic')
    expect(impactFamily(def('wax'))).toBe('wax')
    for (const id of ['foliage', 'cactus', 'flesh_fruit']) expect(impactFamily(def(id)), id).toBe('plant')
    expect(impactFamily(def('green_wood'))).toBe('wood')
    expect(played('ceramic', 'blunt')).not.toBe(played('glass', 'blunt'))
    expect(played('soil', 'ballistic')).not.toBe(played('concrete', 'ballistic'))
    expect(played('plastic', 'blunt')).not.toBe(played('wood_hard', 'blunt'))
  })

  it('a bullet, a blow and a blade sound apart on the main materials', () => {
    for (const id of ['steel', 'wood_hard', 'glass', 'concrete', 'brick']) {
      const sounds = new Set([played(id, 'ballistic'), played(id, 'blunt'), played(id, 'slash')])
      expect(sounds.size, id).toBe(3)
    }
  })

  it('without a blow or a rule the legacy family key still answers', () => {
    expect(played('steel')).toBe('clang')
    expect(played('rubber', 'blunt')).toBe('rubber_hit')
  })

  it('every sound a key names is in the bank', () => {
    const ids = new Set((DESTRUCTION_SOUND_BANK.sounds ?? []).map((s) => s.id))
    for (const [key, rule] of Object.entries(IMPACT_SOUND_KEYS)) expect(ids.has(rule.sound), key).toBe(true)
  })

  it('a game replaces or silences a specific key', () => {
    const own = createDestructionSound(engine, { keys: { impact_steel_ballistic: { sound: 'ping' }, impact_masonry_slash: null } })
    expect(own.rule('impact_metal', impactSoundKeys('steel', def('steel'), 'ballistic'))?.sound).toBe('ping')
    expect(own.rule('impact_masonry', impactSoundKeys('concrete', def('concrete'), 'slash'))).toBeUndefined()
  })
})

describe('ricochet by material', () => {
  it('a round off steel whines, off concrete it cracks short, off glass the old ping stays', () => {
    const rico = (m: string): string | undefined => sound.rule('ricochet', ricochetSoundKeys(m, def(m)))?.sound
    expect(rico('steel')).toBe('ricochet_metal')
    expect(rico('concrete')).toBe('ricochet_stone')
    expect(rico('glass')).toBe('ping')
  })

  it('the preload list has every sound a blow, ricochet or break plays, each once', () => {
    const ids = impactSoundIds()
    expect(new Set(ids).size).toBe(ids.length)
    for (const rule of Object.values(IMPACT_SOUND_KEYS)) expect(ids, rule.sound).toContain(rule.sound)
    expect(ids).toContain('ricochet_stone')
    expect(ids).toContain('ricochet_metal')
    // the room preloads its whole style: the break of a pane is in it, not only the blows (the first shatter was silent while it loaded)
    const style = impactSoundIds(DESTRUCTION_SOUND_KEYS.art_scene)
    for (const id of ['glass_shatter', 'ricochet_stone', 'glass_bullet', 'glass_blade']) expect(style, id).toContain(id)
    expect(impactSoundIds({ a: { sound: 'x', above: { volume: 0.5, sound: 'y' }, fallback: 'z' } })).toEqual(['x', 'y', 'z'])
  })
})
