import { resetWarnOnce } from '@adatechnology/game-contracts'
import { createFluids } from '@adatechnology/game-fluids'
import { createVfx } from '@adatechnology/game-vfx'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFluidRenderer } from '../src'

describe('the effects world fallback says so', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetWarnOnce()
  })

  it('warns once, in development, when the host lends no effects world, and keeps working', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createFluidRenderer(THREE, { scene: new THREE.Scene(), fluids: createFluids() }).dispose()
    createFluidRenderer(THREE, { scene: new THREE.Scene(), fluids: createFluids() }).dispose()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[game-kit\] game-fluids-three made an effects world of its own/)
  })

  it('stays silent when the host lends its effects world', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createFluidRenderer(THREE, { scene: new THREE.Scene(), fluids: createFluids(), vfx: createVfx({}) }).dispose()
    expect(warn).not.toHaveBeenCalled()
  })
})
