import { afterEach, describe, expect, it, vi } from 'vitest'

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { warnOnce } from '../src'
import { resetWarnOnce } from '../src/testing'

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

  it('stays silent when globalThis.__GAME_KIT_QUIET__ is true', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('__GAME_KIT_QUIET__', true)
    warnOnce('a', 'hidden')
    expect(warn).not.toHaveBeenCalled()
    vi.stubGlobal('__GAME_KIT_QUIET__', false)
    warnOnce('a', 'shown')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('the raw IIFE build loads and warns in a context without process', () => {
    const warnings: string[] = []
    const context: Record<string, unknown> = { console: { warn: (message: string) => warnings.push(message) } }
    runInNewContext(readFileSync(new URL('../dist/index.global.js', import.meta.url), 'utf8'), context)
    runInNewContext("GameContracts.warnOnce('k', 'hello')", context)
    expect(warnings).toEqual(['[game-kit] hello'])
  })
})
