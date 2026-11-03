import { resetWarnOnce } from '@adatechnology/game-contracts'
import { createVfx } from '@adatechnology/game-vfx'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld } from './fake-world'

describe('the effects world fallback says so', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetWarnOnce()
  })

  it('warns once, in development, when the host lends no effects world, and keeps working', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scene = new THREE.Scene()
    createDestructionRenderer(THREE, { scene, world: new FakeWorld().asWorld() }).dispose()
    createDestructionRenderer(THREE, { scene, world: new FakeWorld().asWorld() }).dispose()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[game-kit\] game-destruction-three made an effects world of its own/)
  })

  it('stays silent when the host lends its effects world', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createDestructionRenderer(THREE, { scene: new THREE.Scene(), world: new FakeWorld().asWorld(), vfx: createVfx({}) }).dispose()
    expect(warn).not.toHaveBeenCalled()
  })
})
