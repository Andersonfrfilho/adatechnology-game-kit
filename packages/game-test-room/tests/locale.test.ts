import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locales, resolveStrings } from '../src'

describe('locale tables', () => {
  it('en and pt-BR have exactly the same keys', () => {
    expect(Object.keys(locales['pt-BR'].text).sort()).toEqual(Object.keys(locales.en.text).sort())
    expect(Object.keys(locales['pt-BR'].items).sort()).toEqual(Object.keys(locales.en.items).sort())
    expect(Object.keys(locales['pt-BR'].groups).sort()).toEqual(Object.keys(locales.en.groups).sort())
  })

  it('placeholders match between languages', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [k, v] of Object.entries(locales.en.text)) expect(vars(locales['pt-BR'].text[k]), k).toEqual(vars(v))
  })

  it('every key used by the sources exists', () => {
    const dir = join(__dirname, '../src')
    const used = new Set<string>()
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'locale.ts')) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1])
      for (const m of src.matchAll(/\? '([a-z]+\.[a-zA-Z0-9_.]+)' : '([a-z]+\.[a-zA-Z0-9_.]+)'/g)) {
        used.add(m[1])
        used.add(m[2])
      }
    }
    for (const k of used) expect(locales.en.text[k], k).toBeTypeOf('string')
  })

  it('unknown locales fall back to English', () => {
    expect(resolveStrings('xx')).toBe(locales.en)
    expect(resolveStrings(undefined)).toBe(locales.en)
    expect(resolveStrings('pt-BR')).toBe(locales['pt-BR'])
  })
})
