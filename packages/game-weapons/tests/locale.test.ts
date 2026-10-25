import { describe, expect, it } from 'vitest'

import { locales } from '../src'

describe('locales', () => {
  it('en and pt-BR have the same keys in every table', () => {
    for (const table of Object.keys(locales.en) as (keyof typeof locales.en)[]) {
      expect(Object.keys(locales.en[table]).sort(), table).toEqual(Object.keys(locales['pt-BR'][table]).sort())
    }
  })
})
