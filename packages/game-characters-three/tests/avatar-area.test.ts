import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { AVATAR_AREA_ID, createAvatarTestModule, createPlayerAvatar, toRoomAvatar } from '../src'

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const setup = (locale = 'pt-BR') => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room: TestRoom = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
  const avatar = createPlayerAvatar(THREE)
  room.setAvatar(toRoomAvatar(avatar))
  const module = createAvatarTestModule({ avatar, locale, camera: { mode: () => room.cameraMode, set: (mode) => room.setCameraMode(mode) }, state: { set: (state) => room.setAvatarState(state) } })
  const report = room.loadModule(module)
  room.openArea(AVATAR_AREA_ID)
  return { room, avatar, module, report, bench: () => room.bench(AVATAR_AREA_ID)! }
}
const lines = (room: TestRoom) => room.log.entries().filter((e) => e.text.startsWith('{"type":"avatar"')).map((e) => JSON.parse(e.text) as Record<string, unknown>)

describe('avatar test area', () => {
  it('loads into the room and offers the buttons, the clips and the pending animations', () => {
    const { report, bench } = setup()
    expect(report.problems).toEqual([])
    const ids = bench().controls().map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['camera_first', 'camera_third', 'crouch', 'fall', 'get_up', 'armed_on', 'armed_off', 'play_grabbed_bitten_human', 'play_grab_bite_zombie', 'stop_clip']))
    for (const id of ['pending_punch', 'pending_shove', 'pending_kick', 'pending_shot_body']) {
      const control = bench().controls().find((c) => c.id === id)!
      expect(control.disabled).toBe(true)
      expect(control.hint).toMatch(/Elenco/)
      expect(control.hint).toMatch(/Jogador/)
    }
    expect(bench().controls().filter((c) => c.id.startsWith('pending_')).map((c) => c.name)).toEqual(['Soco (…)', 'Empurrão (…)', 'Chute (…)', 'Tiro (corpo) (…)'])
    expect(bench().act('pending_punch')).toBe(false)
  })

  it('has the texts in English too', () => {
    const { bench } = setup('en')
    expect(bench().controls().find((c) => c.id === 'pending_punch')!.hint).toBe('Animation pending delivery by the Elenco team. The rule already exists in the Player area.')
  })

  it('camera buttons change the room view', () => {
    const { room, bench } = setup()
    expect(bench().act('camera_third')).toBe(true)
    expect(room.cameraMode).toBe('third')
    bench().act('camera_first')
    expect(room.cameraMode).toBe('first')
    expect(room.metrics().module.camera).toBe('first')
  })

  it('crouch, fall and armed reach the avatar through the room', () => {
    const { room, bench, avatar } = setup()
    bench().act('crouch')
    bench().act('armed_on')
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    expect(room.avatarState()).toMatchObject({ crouch: true, armed: true, down: false })
    expect(avatar.rig.legs[0]!.kn.rotation.x).toBeGreaterThan(1)
    bench().act('fall')
    for (let i = 0; i < 40; i++) room.update(1 / 60)
    expect(Math.abs(avatar.root.children[0]!.rotation.x)).toBeGreaterThan(1)
    bench().act('get_up')
    bench().act('stand')
    expect(room.avatarState()).toMatchObject({ crouch: false, down: false })
  })

  it('plays a clip, logs every action as JSON and reports the last event and the joints', () => {
    const { room, bench, avatar } = setup()
    bench().act('play_grabbed_bitten_human')
    expect(avatar.playing).toBe('grabbed_bitten_human')
    for (let i = 0; i < 60 * 5; i++) room.update(1 / 60)
    const metrics = room.metrics().module
    expect(metrics.clip).toBe('grabbed_bitten_human')
    expect(String(metrics.last_event)).toMatch(/grabbed_bitten_human (phase|impact)/)
    expect(String(metrics.joints)).toMatch(/^arms .* knees .* lean /)
    bench().act('stop_clip')
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    expect(avatar.playing).toBeNull()
    const records = lines(room)
    expect(records.map((r) => r.action)).toEqual(expect.arrayContaining(['play_clip', 'clip_event', 'stop_clip']))
    expect(records.find((r) => r.action === 'play_clip')).toMatchObject({ type: 'avatar', clip: 'grabbed_bitten_human', duration: 8 })
  })
})
