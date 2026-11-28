import { describe, expect, it } from 'vitest'

import { resolveStrings } from '../src/locale'
import { createRoomVitals } from '../src/room-vitals'

const translate = (locale: 'en' | 'pt-BR') => {
  const S = resolveStrings(locale)
  return (key: string, vars: Record<string, string | number> = {}): string => (S.text[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

describe('the room body', () => {
  it('a drink quenches the thirst its liquid gives, food eaten from its tin feeds by the share eaten', () => {
    const vitals = createRoomVitals(translate('pt-BR'))
    expect(vitals.drank(12)).toBe('sede 20 → 8')
    expect(vitals.ate({ clip: 'eat_food', consumes: true, effect: { id: 'consume_nutrition', satiety: 25, hydration: -5 } }, 0.5)).toBe('fome 20 → 8')
    expect(vitals.ate(undefined, 1)).toBe('')
  })

  it('pills heal and a dressing stops the bleeding of the body, and the HUD view follows', () => {
    const vitals = createRoomVitals(translate('en'))
    vitals.body.state.health = 40
    vitals.body.state.bleeding = 1
    expect(vitals.used({ clip: 'take_medicine', consumes: true, effect: { id: 'heal', params: { amount: 15 } } })).toBe('health 40 → 55')
    expect(vitals.used({ clip: 'apply_dressing', consumes: true, effect: { id: 'stop_bleeding' } })).toBe('no longer bleeding')
    expect(vitals.used({ clip: 'use_hygiene', consumes: false, effect: { id: 'wash' } })).toBe('')
    vitals.update(500, false)
    expect(vitals.view()).toMatchObject({ health: 55, bleeding: false, needMax: 100, needStarving: 90 })
    expect(vitals.view().thirst).toBeCloseTo(60, 4)
  })
})
