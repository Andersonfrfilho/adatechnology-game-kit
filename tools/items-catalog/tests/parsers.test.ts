import { describe, expect, it } from 'vitest'

import { formatDurability, parseDurability } from '../src/parse-durability'

describe('parseDurability', () => {
  it('reads the units of the team text into typed durabilities', () => {
    expect(parseDurability('1 uso')).toEqual({ kind: 'uses', amount: 1 })
    expect(parseDurability('1.000 usos')).toEqual({ kind: 'uses', amount: 1000 })
    expect(parseDurability('3 refeições')).toEqual({ kind: 'portions', amount: 3, per: 'refeições' })
    expect(parseDurability('300 golpes')).toEqual({ kind: 'hits', amount: 300 })
    expect(parseDurability('20 min por cartucho')).toEqual({ kind: 'seconds', amount: 1200, per: 'min por cartucho' })
    expect(parseDurability('6 meses')).toEqual({ kind: 'days', amount: 180, per: 'meses' })
    expect(parseDurability('30 dias')).toEqual({ kind: 'days', amount: 30 })
    expect(parseDurability('40')).toEqual({ kind: 'condition', amount: 40 })
    expect(parseDurability('∞')).toEqual({ kind: 'infinite' })
    expect(parseDurability('contêiner')).toEqual({ kind: 'container' })
    expect(parseDurability('—')).toBeUndefined()
  })

  it('keeps free text as the words of the source, without inventing an amount', () => {
    expect(parseDurability('vida 500')).toEqual({ kind: 'condition', per: 'vida 500' })
    expect(parseDurability('ver Arsenal')).toEqual({ kind: 'condition', per: 'ver Arsenal' })
    expect(parseDurability('10 m')).toEqual({ kind: 'condition', per: '10 m' })
  })

  it('formats back to the same text', () => {
    for (const text of ['1 uso', '2 porções', '3 refeições', '1.000 usos', '12 s de jato', '8 h de lanterna', '1 ano', '2 dias de uso', '1 par', '40', 'vida 500', '∞', '—']) {
      expect(formatDurability(parseDurability(text))).toBe(text)
    }
  })
})
