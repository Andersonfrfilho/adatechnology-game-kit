import { describe, expect, it } from 'vitest'

import { ELENCO_RULES, PROTECTION_PRESETS, TEAM_GAME_CALIBERS, TEAM_GAME_CALIBER_KEYS, resolveDamageRules } from '../src'
import decisions from '../../../tools/characters-catalog/decisions.json'

describe('presets come from the catalog decisions', () => {
  it('the protection presets are the ones decisions.json gives game-items (ROUPAS)', () => {
    const byId = new Map(PROTECTION_PRESETS.map((layer) => [layer.id, layer]))
    for (const preset of Object.values(decisions.protectionPresets.value)) {
      const layer = byId.get(preset.protectionId)
      expect(layer, preset.protectionId).toBeDefined()
      if ('resistance' in preset) expect(layer?.ballistic?.resistance).toBe(preset.resistance)
      if ('blunt' in preset) expect(layer?.ballistic?.blunt).toBe(preset.blunt)
      if ('pass' in preset) expect(layer?.ballistic?.pass).toBe(preset.pass)
      if ('consumable' in preset) expect(layer?.ballistic?.consumable).toBe(preset.consumable)
      if ('fire' in preset) expect(layer?.fire).toBe(preset.fire)
      if ('limbs' in preset) expect(layer?.limbs).toBe(preset.limbs)
    }
  })

  it('the team-game calibre table maps the game keys to the kit ids', () => {
    expect(TEAM_GAME_CALIBER_KEYS).toEqual({ '308': '7_62x51', '9x19': '9x19', '12ga': '12ga_00buck', '762x39': '7_62x39' })
    expect(TEAM_GAME_CALIBERS.find((entry) => entry.id === '12ga_00buck')).toMatchObject({ points: 12, penetration: 0.5, class: 'pistol', skullRange: 8, pellets: 9 })
  })

  it('the Elenco rules use the Elenco hit points and no multiplier', () => {
    expect(ELENCO_RULES.segments.torso).toMatchObject({ hitPoints: 120, multiplier: 1 })
    expect(ELENCO_RULES.segments.hand.hitPoints).toBe(25)
    expect(ELENCO_RULES.spread).toBe(0.15)
  })

  it('damage options merge over a preset key by key', () => {
    const rules = resolveDamageRules({ preset: 'arsenal', severity: { headKillDamage: 25 }, segments: { head: { hitPoints: 50, multiplier: 3, bleed: 40 } } })
    expect(rules.segmentRule).toBe('arsenal')
    expect(rules.severity.headKillDamage).toBe(25)
    expect(rules.severity.splitAtDamage).toBe(150)
    expect(rules.segments.head.hitPoints).toBe(50)
    expect(rules.segments.torso.hitPoints).toBe(150)
  })
})
