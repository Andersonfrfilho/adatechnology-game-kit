import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetWarnOnce, warnOnce } from '../src'

describe('warnOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetWarnOnce()
  })

  it('warns once per key, with the kit prefix', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnOnce('a', 'first')
    warnOnce('a', 'first again')
    warnOnce('b', 'second')
    expect(warn.mock.calls).toEqual([['[game-kit] first'], ['[game-kit] second']])
  })

  it('stays silent in production and warns again after a reset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    warnOnce('a', 'hidden')
    expect(warn).not.toHaveBeenCalled()
    vi.stubEnv('NODE_ENV', 'test')
    warnOnce('a', 'shown')
    resetWarnOnce()
    warnOnce('a', 'shown again')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
