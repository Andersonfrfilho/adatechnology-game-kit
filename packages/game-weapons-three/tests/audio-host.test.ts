import { createAudioEngine } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

// T6.3: the weapons module plays on the room's engine, the one the host lends in host.audio, and not on a context of its own.
describe('weapons module on the host audio', () => {
  it('plays its sounds on the engine the room lends, and leaves that engine open when the room goes', () => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 2, mix: 'game', createContext: () => recorder.context })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: demoItems('en'), renderer: stubRenderer(), ui: false, audio: engine })
    const module = createWeaponsTestModule({ locale: 'en' })
    expect(room.loadModule(module).problems).toEqual([])
    module.audio?.play('glass', 1, 0)
    expect(engine.stats().voices).toBeGreaterThan(0)
    expect(recorder.trace().entries.some((entry) => entry.op === 'start')).toBe(true)
    room.dispose()
    expect(recorder.trace().entries.some((entry) => entry.op === 'close')).toBe(false)
  })
})
