import { describe, expect, it } from 'vitest'

import { buildCatalog } from '../src/build'
import { outputPath } from '../src/paths'
import { loadSources } from '../src/sources'

const sources = loadSources()
const locale = JSON.parse(buildCatalog()[outputPath('locales/pt-BR')] ?? '{}') as Record<string, string>

describe('pt-BR texts', () => {
  it('uses the team name of every team item', () => {
    for (const item of sources.ite.itens.filter((candidate) => !sources.decisions.scope[candidate.id])) {
      const id = Object.entries(locale).find(([, text]) => text === item.n)
      expect(id, item.n).toBeDefined()
    }
  })

  it('has no name in decisions.json that nothing uses', () => {
    const unused = Object.keys(sources.decisions.names).filter((key) => !(key in locale))
    expect(unused).toEqual([])
  })

  it('keeps a frozen name, in both languages, for every household item', () => {
    for (const language of ['pt-BR', 'en'] as const) expect(Object.keys(sources.householdNames[language]).sort()).toEqual(Object.keys(sources.household).map((id) => `item.${id}`).sort())
  })

  it('has no empty text', () => {
    for (const [key, text] of Object.entries(locale)) expect(text.trim(), key).not.toBe('')
  })
})
