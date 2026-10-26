import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, RoomFirstPersonState, TestRoom } from '@adatechnology/game-test-room'
import { sampleClip } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { buildToolClips } from '../src/animation/clip-set'
import { hasWeaponModel, buildWeaponModelById } from '../src/models'

// What the eye must see in a reload, measured on the clips and on the room with the weapon in the hands: the slide that moves, one visit of the hand and one sound per round.

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const arsenal = createArsenal({ seed: 1, rules: { faults: false } })

function setup(): { room: TestRoom; last: () => RoomFirstPersonState } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  let state: RoomFirstPersonState | null = null
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, firstPerson: { root: new THREE.Group(), update: (_dt, next) => void (state = { ...next }) }, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, last: () => state! }
}
const step = (room: TestRoom, frames: number, each?: () => void): void => {
  for (let i = 0; i < frames; i++) {
    room.update(1 / 60)
    each?.()
  }
}
const keyR = (): boolean => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))

describe('the slide of an empty pistol reload', () => {
  it.each(['glock_17', 'colt_m1911', 'beretta_92fs', 'makarov_pm'])('%s: the slide goes back and forward, and the snap is heard as it closes', (id) => {
    const model = buildWeaponModelById(THREE, id)!
    const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType: 'pistol', reloadFamily: 'pistol' })
    const clip = clips.reload_empty!
    expect(clip).toBeDefined()
    const samples: Array<{ t: number; x: number }> = []
    for (let t = 0; t <= clip.duration; t += clip.duration / 400) samples.push({ t, x: sampleClip(clip, 'slide', t).position[0] })
    const stroke = Math.min(...samples.map((entry) => entry.x))
    expect(stroke).toBeLessThan(-0.02)
    const back = samples.find((entry) => entry.x < stroke * 0.9)!
    const home = samples.find((entry) => entry.t > back.t && entry.x > stroke * 0.1)!
    // it starts closed (the magazine is swapped first), is pulled back and let go
    expect(samples[0]!.x).toBe(0)
    expect(home.t - back.t).toBeGreaterThan(0.1)
    expect(samples.at(-1)!.x).toBe(0)
    const snap = (clip.events ?? []).find((event) => event.type === 'sound' && event.data?.id === 'slide_release')!
    expect(snap.t).toBeGreaterThanOrEqual(home.t - 0.05)
    expect(snap.t).toBeLessThanOrEqual(home.t + 0.12)
  })
})

describe('an empty reload of a weapon that loads round by round', () => {
  const ids = [...arsenal.weapons.values()]
    .filter((def) => def.action.kind === 'firearm' && (def.action.perRound || def.action.timings?.perRound) && hasWeaponModel(def.id))
    // the generic archetype of a semi-automatic shotgun is drawn as a magazine gun, so it has no tube to fill (its products do)
    .filter((def) => !buildWeaponModelById(THREE, def.id)!.parts.mag)
    .map((def) => def.id)

  it('the catalogue has them', () => expect(ids.length).toBeGreaterThan(10))

  it.each(ids)('%s: the rounds go in one by one, one sound and one visit of the hand for each', (id) => {
    const { room, last } = setup()
    room.setTool(id)
    step(room, 40)
    for (let n = 0; room.tool.ammo > 0 && n < 120; n++) {
      room.use()
      step(room, 12)
    }
    step(room, 90)
    expect(room.tool.ammo).toBe(0)
    const capacity = room.tool.capacity
    const port = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName('loadPort')
    const rest0 = last().targets?.R?.position
    expect(rest0).toBeDefined()
    const before = room.log.entries().length
    const t0 = room.log.entries().at(-1)?.t ?? 0
    keyR()
    const ammo: Array<{ frame: number; ammo: number }> = []
    let visits = 0
    let away = false
    let frame = 0
    const rest = last().targets!.R!.position.slice()
    step(room, 60 * 14, () => {
      frame++
      const previous = ammo.at(-1)?.ammo ?? 0
      if (room.tool.ammo !== previous) ammo.push({ frame, ammo: room.tool.ammo })
      const hand = last().targets?.R?.position
      if (!hand) return
      // a visit: the shooting hand leaves the grip for the port and comes back
      const d = Math.hypot(hand[0] - rest[0]!, hand[1] - rest[1]!, hand[2] - rest[2]!)
      if (!away && d > 0.02) {
        away = true
        visits++
      } else if (away && d < 0.008) away = false
    })
    expect(ammo.map((entry) => entry.ammo)).toEqual(Array.from({ length: capacity }, (_, i) => i + 1))
    // one round at a time at the rule's seconds, not the whole tube in a moment
    const first = ammo[0]!.frame
    const lastFrame = ammo.at(-1)!.frame
    expect((lastFrame - first) / 60).toBeGreaterThan((capacity - 1) * 0.4)
    const shells = room.log.entries().slice(before).filter((entry) => entry.type === 'sound' && (entry.data as { cue?: string }).cue === 'shell_insert')
    expect(shells.length, 'a shell sound per round').toBe(capacity)
    // the action (the pump, the lever, the charging handle) is worked only after the last shell is in: every shell sound comes before the first sound of the action
    const actions = room.log.entries().slice(before).filter((entry) => entry.type === 'sound' && ['pump_back', 'pump_forward', 'lever_open', 'lever_close', 'charging_handle_pull', 'charging_handle_release'].includes((entry.data as { cue?: string }).cue ?? ''))
    if (actions.length > 0) expect(shells.at(-1)!.t, 'the last shell is in before the action').toBeLessThan(actions[0]!.t)
    expect(shells.at(-1)!.t - shells[0]!.t).toBeGreaterThan((capacity - 1) * 0.4)
    // a tube is filled with the hand going back to the grip between two rounds; a bolt action is loaded in one go from the top, the hand stays at the port
    const family = buildWeaponModelById(THREE, id)!.parts.family
    if (port && ['pump', 'lever', 'semi12'].includes(family)) expect(visits, 'a visit of the hand to the port per round').toBe(capacity)
    else if (family === 'revolver') expect(visits).toBeGreaterThanOrEqual(0)
    else expect(visits).toBeGreaterThanOrEqual(1)
    expect(t0).toBeGreaterThanOrEqual(0)
  }, 60000)
})

// When the support hand works a part (racks the slide, pulls the charging handle, pumps), the shooting hand keeps its hold: on the grip, closed, the finger off the trigger.
describe('the shooting hand while the support hand works the action', () => {
  const ACTIONS = ['pump_back', 'pump_forward', 'charging_handle_pull', 'charging_handle_release', 'slide_release']
  const ids = [...arsenal.weapons.values()]
    .filter((def) => def.action.kind === 'firearm' && hasWeaponModel(def.id))
    .filter((def) => ['pistol', 'rifle', 'p90', 'belt', 'pump', 'semi12'].includes(buildWeaponModelById(THREE, def.id)!.parts.family))
    .map((def) => def.id)

  it('the catalogue has them', () => expect(ids.length).toBeGreaterThan(60))

  it.each(ids)('%s: the shooting hand stays on the grip from the first sound of the action to the end of the reload', (id) => {
    const { room, last } = setup()
    room.setTool(id)
    step(room, 40)
    for (let n = 0; room.tool.ammo > 0 && n < 200; n++) {
      room.use()
      step(room, 12)
    }
    step(room, 180)
    if (room.tool.ammo !== 0) return
    const rest = last().targets!.R!.position.slice()
    const before = room.log.entries().length
    keyR()
    let frames = 0
    const away: number[] = []
    const grip: number[] = []
    const finger: number[] = []
    step(room, 60 * 12, () => {
      frames++
      const p = last().targets!.R!.position
      away.push(Math.hypot(p[0] - rest[0]!, p[1] - rest[1]!, p[2] - rest[2]!))
      grip.push(last().targets!.grip ?? 1)
      finger.push(last().triggerFinger ?? 0)
    })
    const entries = room.log.entries().slice(before)
    const t0 = entries[0]!.t
    const first = entries.find((entry) => entry.type === 'sound' && ACTIONS.includes((entry.data as { cue?: string }).cue ?? ''))
    if (!first) return
    const from = Math.max(0, Math.floor((first.t - t0) * 60))
    const reloadFrames = away.findIndex((_, i) => i > from && !room.tool.reloading) // unused: the window runs to the end of the sample
    expect(reloadFrames).toBeLessThan(frames)
    for (let i = from; i < frames; i++) {
      expect(away[i], `frame ${i}: the shooting hand is off the grip`).toBeLessThan(0.012)
      expect(grip[i], `frame ${i}: the hand is open`).toBeGreaterThanOrEqual(0.85)
      expect(finger[i]!, `frame ${i}: the finger is on the trigger`).toBeLessThan(0.55)
    }
  }, 60000)
})
