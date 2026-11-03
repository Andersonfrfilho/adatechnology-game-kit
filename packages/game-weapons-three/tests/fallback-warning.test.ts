import { resetWarnOnce } from '@adatechnology/game-contracts'
import { createAudioEngine } from '@adatechnology/game-audio'
import { createTestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWeaponAudio, createWeaponFx, createWeaponsTestModule } from '../src'

const warnings = (spy: ReturnType<typeof vi.spyOn>): string[] => spy.mock.calls.map((call) => String(call[0])).filter((text) => text.startsWith('[game-kit]'))
const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
const fxOptions = { THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), arsenal, groundAt: () => 0, audio: null }

describe('the own effects world and audio engine of the weapons say so', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetWarnOnce()
  })

  it('warns once, in development, when no effects world is lent to the hands, and keeps working', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createWeaponFx(fxOptions).dispose()
    createWeaponFx(fxOptions).dispose()
    expect(warnings(warn)).toHaveLength(1)
    expect(warnings(warn)[0]).toMatch(/^\[game-kit\] game-weapons-three made an effects world of its own/)
  })

  it('warns once, in development, when no audio engine is lent, and keeps working', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createWeaponAudio().dispose()
    createWeaponAudio().dispose()
    expect(warnings(warn)).toHaveLength(1)
    expect(warnings(warn)[0]).toMatch(/^\[game-kit\] game-weapons-three made an audio engine of its own/)
  })

  it('stays silent when the host lends the effects and the audio engine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createWeaponFx({ ...fxOptions, effects: { play: () => 1, stop: () => undefined } }).dispose()
    createWeaponAudio(0.6, { engine: createAudioEngine({ seed: 1, mix: 'game' }) }).dispose()
    expect(warnings(warn)).toEqual([])
  })

  it('never fires in the test room, which lends the effects and the audio engine to the weapons module', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = { domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer, ui: false, arsenal })
    expect(room.loadModule(createWeaponsTestModule({ locale: 'en', arsenal })).problems).toEqual([])
    for (let elapsed = 0; elapsed < 0.2; elapsed += 0.02) room.update(0.02)
    expect(warnings(warn)).toEqual([])
  })
})
