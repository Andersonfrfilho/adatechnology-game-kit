import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, TestRoom } from '@adatechnology/game-test-room'

type HandState = ReturnType<TestRoom['handState']>
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'
import { MODEL_ENTRIES, buildWeaponModelById } from '../src/models'
import { TRIGGER_FINGER } from '../src/fx/viewmodel'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function setup(): { room: TestRoom; last: () => HandState } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, last: () => room.handState() }
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

  it('glock_17 (empty): the support hand reaches over to the slide and racks it', () => {
    const { min, rest } = reloadReach('glock_17', 'L', 'slide', 'empty')
    expect(min).toBeLessThan(0.09)
    expect(min).toBeLessThan(rest - 0.02)
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

/** How far the hand target strays from where it rests while B turns the safety, and its closest pass to `partName` (when given), in metres. */
const safetyReach = (weapon: string, hand: 'R' | 'L', partName?: string): { moved: number; min: number; rest: number; safe: boolean } => {
  const { room, last } = setup()
  room.setTool(weapon)
  step(room, 40)
  const part = partName ? room.scene.getObjectByName('weapon-viewmodel')!.getObjectByName(partName) : undefined
  const at = (): THREE.Vector3 => new THREE.Vector3(...last().targets![hand]!.position)
  const distance = (): number => {
    if (!part) return 0
    const box = new THREE.Box3().setFromObject(part)
    return (box.isEmpty() ? part.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3())).distanceTo(at())
  }
  const start = at()
  const rest = distance()
  const safe = room.tool.safety
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
  let moved = 0
  let min = Infinity
  step(room, 40, () => {
    moved = Math.max(moved, at().distanceTo(start))
    min = Math.min(min, distance())
  })
  return { moved, min, rest, safe: room.tool.safety !== safe }
}

describe('the safety (B): the weapon cants and a hand works the lever', () => {
  it.each([
    ['glock_18', 'R'],
    ['colt_m4a1', 'R'],
    ['ak_47', 'L'],
    ['remington_870', 'R'],
    ['glock_17', 'R'],
  ] as const)('%s: the %s hand moves while the safety turns', (weapon, hand) => {
    const { moved, safe } = safetyReach(weapon, hand)
    expect(safe).toBe(true)
    expect(moved).toBeGreaterThan(0.01)
  })

  it('glock_18: the thumb of the shooting hand comes toward the lever', () => {
    const { min, rest } = safetyReach('glock_18', 'R', 'safety')
    expect(min).toBeLessThan(rest - 0.01)
  })

  it('ak_47: the support hand goes over to the lever on the right of the receiver', () => {
    const { min } = safetyReach('ak_47', 'L', 'bolt')
    expect(min).toBeLessThan(0.05)
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

  it('the room hand state says how far the finger is curled on every frame: extended at rest, fully pulled on a shot, back to extended', () => {
    const { room, last } = setup()
    room.setTool('glock_17')
    step(room, 40)
    expect(room.handState().triggerFinger).toBe(0)
    expect(last().triggerFinger).toBe(0)
    room.use()
    let highest = 0
    step(room, 20, () => {
      expect(room.handState().triggerFinger).toBe(last().targets!.fingers!.index)
      highest = Math.max(highest, room.handState().triggerFinger!)
    })
    expect(highest).toBeGreaterThanOrEqual(0.95)
    step(room, 60 * 3)
    expect(room.handState().triggerFinger).toBe(0)
    room.setTool('fists')
    step(room, 10)
    expect(room.handState().triggerFinger).toBeNull()
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
