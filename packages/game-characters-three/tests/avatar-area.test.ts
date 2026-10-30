import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { POSE_CLIPS } from '@adatechnology/game-characters'
import { ATTACK_CLIPS, ATTACK_CLIP_LOCALES } from '@adatechnology/game-characters-people'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { AVATAR_AREA_ID, createAvatarTestModule, createPlayerAvatar, toRoomAvatar } from '../src'
import type { AvatarTestOptions } from '../src'

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const setup = (locale = 'pt-BR') => setupWith({}, locale)
const setupWith = (extra: Partial<AvatarTestOptions>, locale = 'pt-BR') => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room: TestRoom = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
  const avatar = createPlayerAvatar(THREE)
  room.setAvatar(toRoomAvatar(avatar))
  const module = createAvatarTestModule({ ...extra, avatar, locale, camera: { mode: () => room.cameraMode, set: (mode) => room.setCameraMode(mode) }, state: { set: (state) => room.setAvatarState(state) } })
  const report = room.loadModule(module)
  room.openArea(AVATAR_AREA_ID)
  return { room, avatar, module, report, bench: () => room.bench(AVATAR_AREA_ID)! }
}
const lines = (room: TestRoom) => room.log.entries().filter((e) => e.text.startsWith('{"type":"avatar"')).map((e) => JSON.parse(e.text) as Record<string, unknown>)

describe('avatar test area', () => {
  it('loads into the room and offers the buttons and the clips', () => {
    const { report, bench } = setup()
    expect(report.problems).toEqual([])
    const ids = bench().controls().map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['camera_first', 'camera_third', 'crouch', 'fall', 'get_up', 'armed_on', 'armed_off', 'play_grabbed_bitten_human', 'play_grab_bite_zombie', 'stop_clip']))
    expect(ids.filter((id) => id.startsWith('pending_'))).toEqual([])
  })

  it('has the texts in English too', () => {
    const { bench } = setup('en')
    expect(bench().controls().find((c) => c.id === 'play_grabbed_bitten_human')!.name).toBe('Play: grabbed_bitten_human')
    expect(bench().controls().find((c) => c.id === 'stop_clip')!.name).toBe('Stop clip')
  })

  it('offers a button per attack clip, plays it and logs the impact', () => {
    const { room, avatar, bench } = setupWith({ clips: [...POSE_CLIPS, ...ATTACK_CLIPS], clipLocales: ATTACK_CLIP_LOCALES })
    // the strikes (the fighting guard has no impact; it holds the fists up between punches)
    for (const clip of ATTACK_CLIPS.filter((candidate) => candidate.events?.some((event) => event.type === 'impact'))) {
      const button = bench().controls().find((c) => c.id === `play_${clip.id}`)!
      expect(button.name).toBe(`Tocar: ${clip.id}`)
      expect(bench().act(`play_${clip.id}`)).toBe(true)
      expect(avatar.playing).toBe(clip.id)
      for (let i = 0; i < 60 * 2; i++) room.update(1 / 60)
      const records = lines(room)
      const impacts = records.filter((r) => r.action === 'impact' && r.clip === clip.id)
      expect(impacts, clip.id).toHaveLength(1)
      expect(impacts[0]).toMatchObject({ type: 'avatar', clip: clip.id, t: clip.events!.find((event) => event.type === 'impact')!.t })
      expect(String(room.metrics().module.last_event)).toMatch(new RegExp(`^${clip.id} phase `))
      expect(String(room.metrics().module.last_event)).not.toMatch(/attack_clip\.phase/)
    }
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
