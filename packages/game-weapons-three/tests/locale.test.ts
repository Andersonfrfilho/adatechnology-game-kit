import { describe, expect, it } from 'vitest'

import { ACCESSORY_TEXT } from '../src/test-area/accessory-text'

const keysOf = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, item]) => keysOf(item, prefix === '' ? key : `${prefix}.${key}`))
    : [prefix]

describe('accessory text', () => {
  it('en and pt-BR have the same keys', () => {
    expect(keysOf(ACCESSORY_TEXT.en).sort()).toEqual(keysOf(ACCESSORY_TEXT['pt-BR']).sort())
  })
})
