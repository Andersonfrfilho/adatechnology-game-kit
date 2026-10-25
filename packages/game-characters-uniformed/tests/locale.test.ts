import { describe, expect, it } from 'vitest'

import { RANKS } from '../src'

describe('rank rule text', () => {
  it('has en and pt-BR', () => {
    expect(Object.keys(RANKS.rule.text).sort()).toEqual(['en', 'pt-BR'])
  })
})
