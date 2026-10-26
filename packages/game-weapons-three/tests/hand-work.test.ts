import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, RoomFirstPersonState, TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { MODEL_ENTRIES, buildWeaponModelById } from '../src/models'
import { TRIGGER_FINGER } from '../src/fx/viewmodel'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function setup(): { room: TestRoom; last: () => RoomFirstPersonState } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
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
const empty = (room: TestRoom): void => {
  for (let n = 0; room.tool.ammo > 0 && n < 120; n++) {
    room.use()
    step(room, 6)
  }
  step(room, 60)
}

/** The closest a hand target comes to a part of the weapon during the reload that follows `keyR`, and the part's travel. */
const reloadReach = (weapon: string, hand: 'R' | 'L', partName: string, mode: 'empty' | 'partial'): { min: number; rest: number } => {
  const { room, last } = setup()
  room.setTool(weapon)
  step(room, 40)
  if (mode === 'empty') empty(room)
  else {
    room.use()
    step(room, 20)
  }
  const part = room.scene.getObjectByName('weapon-viewmodel')!.getObjectByName(partName)
  if (!part) throw new Error(`${weapon}: no part ${partName}`)
  const distance = (): number => {
    const p = last().targets![hand]!.position
    part.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(part)
    const at = box.isEmpty() ? part.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3())
    return at.distanceTo(new THREE.Vector3(...p))
  }
  const rest = distance()
  keyR()
  let min = Infinity
  step(room, 60 * 12, () => {
    // the hand goes to the port after each round the rule feeds, so the last visit ends as the reload does
    if (!room.tool.reloading && partName !== 'loadPort') return
    min = Math.min(min, distance())
  })
  return { min, rest }
}

describe('the hands work the parts the reload clip moves', () => {
  it.each([
    ['makarov_pm', 'L', 'slide'],
    ['colt_m4a1', 'L', 'bolt'],
    ['ak_47', 'L', 'bolt'],
    ['hk_mp5a3', 'L', 'bolt'],
  ] as const)('%s (empty): the %s hand goes to the %s while the clip moves it', (weapon, hand, part) => {
    const { min, rest } = reloadReach(weapon, hand, part, 'empty')
    expect(min).toBeLessThan(0.07)
    expect(min).toBeLessThan(rest - 0.02)
  })

  it('a pistol with a slide stop (glock_17) works it with the thumb: the shooting hand rises off the grip', () => {
    const { room, last } = setup()
    room.setTool('glock_17')
    step(room, 40)
    empty(room)
    const rest = last().targets!.R!.position.slice()
    keyR()
    let farthest = 0
    step(room, 60 * 4, () => {
      const p = last().targets!.R!.position
      farthest = Math.max(farthest, Math.hypot(p[0] - rest[0], p[1] - rest[1], p[2] - rest[2]))
    })
    expect(farthest).toBeGreaterThan(0.008)
  })

  it.each([
    ['remington_700', 'R', 'boltHandle'],
    ['revolver_357', 'L', 'crane'],
  ] as const)('%s: the %s hand goes to the %s during the reload', (weapon, hand, part) => {
    const { min } = reloadReach(weapon, hand, part, 'partial')
    expect(min).toBeLessThan(0.04)
  })

  it.each(['remington_870', 'benelli_m4', 'ruger_10_22', 'winchester_1894'])('%s: the shooting hand goes to the loading port to load the rounds', (weapon) => {
    const { min, rest } = reloadReach(weapon, 'R', 'loadPort', 'partial')
    expect(min).toBeLessThan(0.07)
    expect(min).toBeLessThan(rest - 0.02)
  })

  it('a tactical reload does not pull anything: the support hand never takes the charging handle, an empty one does', () => {
    const tactical = reloadReach('colt_m4a1', 'L', 'bolt', 'partial')
    const emptied = reloadReach('colt_m4a1', 'L', 'bolt', 'empty')
    expect(tactical.min).toBeGreaterThan(0.07)
    expect(emptied.min).toBeLessThan(0.07)
  })
})

describe('the trigger finger', () => {
  const indexAfter = (weapon: string, frames: number[]): number[] => {
    const { room, last } = setup()
    room.setTool(weapon)
    step(room, 40)
    const out: number[] = [last().targets!.fingers?.index ?? NaN]
    room.use()
    for (const n of frames) {
      step(room, n)
      out.push(last().targets!.fingers?.index ?? NaN)
    }
    return out
  }

  it('rests along the frame, goes to the trigger and pulls on a shot, then releases and rests again', () => {
    const { room, last } = setup()
    room.setTool('glock_17')
    step(room, 40)
    expect(last().targets!.fingers!.index).toBeCloseTo(TRIGGER_FINGER.safe, 2)
    room.use()
    let highest = 0
    step(room, 20, () => (highest = Math.max(highest, last().targets!.fingers!.index!)))
    expect(highest).toBeGreaterThan(TRIGGER_FINGER.ready)
    step(room, 60 * 3)
    expect(last().targets!.fingers!.index).toBeCloseTo(TRIGGER_FINGER.safe, 2)
  })

  it('every weapon with a trigger part gives a finger and the others keep the normal grip', () => {
    const [rested] = indexAfter('glock_17', [1])
    expect(rested).toBeCloseTo(TRIGGER_FINGER.safe, 2)
    const bare = MODEL_ENTRIES && Object.keys(MODEL_ENTRIES).find((id) => !buildWeaponModelById(THREE, id)?.parts.trigger)
    if (!bare) return
    const { room, last } = setup()
    room.setTool(bare)
    step(room, 40)
    expect(last().targets!.fingers?.index).toBeUndefined()
  })
})
