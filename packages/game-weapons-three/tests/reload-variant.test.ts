import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}
const setup = (locale: 'en' | 'pt-BR' = 'en'): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale, sound: false, arsenal })).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return room
}
const step = (room: TestRoom, frames: number): void => {
  for (let i = 0; i < frames; i++) room.update(1 / 60)
}
const keyR = (): boolean => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
const played = (room: TestRoom): { kind: string; clip: string; seconds: number; text: string } => {
  const entry = room.log.entries().filter((e) => (e.data as { clip?: string } | undefined)?.clip !== undefined).at(-1)
  expect(entry).toBeDefined()
  const data = entry!.data as { kind: string; clip: string; seconds: number }
  return { ...data, text: entry!.text }
}

describe('the reload the clip shows follows the chamber', () => {
  for (const weapon of ['glock_17', 'colt_m4a1', 'ak_47']) {
    it(`${weapon}: an empty weapon plays reload_empty, one with a round chambered the tactical reload`, () => {
      const room = setup()
      room.setTool(weapon)
      step(room, 40)
      room.use()
      step(room, 20)
      expect(room.tool.ammo).toBeGreaterThan(0)
      keyR()
      step(room, 5)
      const tactical = played(room)
      expect(tactical.kind).toBe('tactical')
      expect(tactical.clip).toBe('reload')
      step(room, 300)
      for (let n = 0; room.tool.ammo > 0 && n < 120; n++) {
        room.use()
        step(room, 6)
      }
      step(room, 60)
      expect(room.tool.ammo).toBe(0)
      keyR()
      step(room, 5)
      const emptied = played(room)
      expect(emptied.kind).toBe('empty')
      expect(emptied.clip).toBe('reload_empty')
      expect(emptied.seconds).toBeGreaterThan(tactical.seconds - 1e-6)
      expect(emptied.text).toContain('empty chamber')
    })
  }

  it('says it in pt-BR too', () => {
    const room = setup('pt-BR')
    room.setTool('glock_17')
    step(room, 40)
    for (let n = 0; room.tool.ammo > 0 && n < 120; n++) {
      room.use()
      step(room, 6)
    }
    step(room, 60)
    keyR()
    step(room, 5)
    expect(played(room).text).toContain('vazia')
  })
})
