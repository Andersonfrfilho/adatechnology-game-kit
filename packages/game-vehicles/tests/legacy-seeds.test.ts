import { describe, expect, it } from 'vitest'
import { legacyGlassId, legacyZoneId, registerLegacySeeds } from '../src'
import { makeKit } from './helpers/kit'

describe('registerLegacySeeds', () => {
  it('adds legacy zone ids and glass labels that the seeds use', () => {
    expect(legacyZoneId({ id: 'zz_new_zone' })).toBe('zz_new_zone')
    expect(legacyGlassId('zz_pane', 'Pane', 0, null, 'fallback')).toBe('fallback')
    registerLegacySeeds({ zones: { zz_new_zone: 'zona_antiga' }, glassLabels: { zz_pane: 'Janela da cabine' } })
    expect(legacyZoneId({ id: 'zz_new_zone' })).toBe('zona_antiga')
    expect(legacyZoneId({ id: 'zz_new_zone', seedId: 'explicit' })).toBe('explicit')
    expect(legacyGlassId('zz_pane', 'Pane', 0, null, 'fallback')).toBe('janela_da_cabine')
    expect(legacyGlassId('zz_pane', 'Pane', -1, null, 'fallback')).toBe('janela_da_cabine_esquerda')
    expect(legacyGlassId('zz_pane', 'Pane', 0, 'right', 'fallback')).toBe('janela_da_cabine_direito')
  })

  it('is idempotent and refuses a second meaning for the same id', () => {
    registerLegacySeeds({ zones: { zz_twice: 'um' } })
    expect(() => registerLegacySeeds({ zones: { zz_twice: 'um' } })).not.toThrow()
    expect(() => registerLegacySeeds({ zones: { zz_twice: 'dois' } })).toThrow(/already maps/)
    expect(() => registerLegacySeeds({ glassLabels: { windshield: 'Outro' } })).toThrow(/already maps/)
  })

  it('is also reachable from the kit', () => {
    const kit = makeKit({}, false)
    kit.registerLegacySeeds({ zones: { zz_kit_zone: 'zona_kit' } })
    expect(legacyZoneId({ id: 'zz_kit_zone' })).toBe('zona_kit')
  })

  it('treats keys that contain windshield or rear as the windshield and the rear glass', () => {
    const kit = makeKit()
    const original = kit.addGlass
    const rename: Record<string, string> = { windshield: 'cockpit_windshield', rear_window: 'cockpit_rear_glass' }
    const panes = () => {
      kit.addGlass = (c: any, g: any, label: any, type: any, o: any) => {
        const key = label && label.key
        return original(c, g, key && rename[key] ? { key: rename[key], label: 'Pane' } : label, type, o)
      }
      try {
        return kit.build('proto', 'intact').zones.filter((z) => z.glass && z.glass.length)
      } finally {
        kit.addGlass = original
      }
    }
    const zones = panes()
    const front = zones.find((z) => z.id.startsWith('glass_cockpit_windshield'))!
    expect(front.tags).toContain('windshield')
    expect(front.fxKey).toBe('windshield')
    const rear = zones.find((z) => z.id.startsWith('glass_cockpit_rear_glass'))!
    expect(rear.tags).not.toContain('windshield')
    expect(rear.who).toBe(kit.t('who.rear_seats'))
  })
})
