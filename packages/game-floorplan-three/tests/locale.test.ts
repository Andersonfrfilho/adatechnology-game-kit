import { describe, expect, it } from 'vitest'

import { createTranslator, en, locales, ptBR } from '../src'

// The texts the house shows to the player.
describe('locale', () => {
  it('has the same keys in every language', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(locales).sort()).toEqual(['en', 'pt-BR'])
  })

  it('fills the parameters and falls back to English for an unknown language', () => {
    expect(createTranslator('pt-BR')('prompt.open', { what: 'a porta' })).toBe('E: abrir a porta')
    expect(createTranslator('xx')('prompt.open', { what: 'the door' })).toBe('E: open the door')
    expect(createTranslator({ 'prompt.open': 'Open {what}' })('prompt.open', { what: 'x' })).toBe('Open x')
  })
})
