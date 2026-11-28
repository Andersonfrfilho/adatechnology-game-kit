import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { ModuleItemUse } from '@adatechnology/game-contracts'

import type { RoomAvatar, TestRoomItem } from '../src'
import { DEFAULT_STRIKE_CLIPS } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) room.update(1 / 60)
}

/** A small thing without a liquid that is used in the hand (`use`), drawn as the demo glass bottle. */
const usedInHand = (id: string, use: ModuleItemUse): TestRoomItem => {
  const bottle = demoItems('en').find((item) => item.id === 'glass_bottle')!
  const { fluid: _fluid, seal: _seal, ...dry } = bottle
  return { ...dry, id, name: id, use }
}
const APPLE = usedInHand('test_apple', { clip: 'eat_food', consumes: true, effect: { id: 'consume_nutrition', satiety: 8, hydration: 6 } })
const SOAP = usedInHand('test_soap', { clip: 'use_hygiene', consumes: false, effect: { id: 'wash' } })
const PILLS = usedInHand('test_pills', { clip: 'take_medicine', consumes: true, effect: { id: 'heal', params: { amount: 15 } } })

const holding = (id: string, locale: 'en' | 'pt-BR' = 'en') => {
  const room = makeRoom({ locale, catalog: demoItems(locale, [APPLE, SOAP, PILLS]) })
  const body = new THREE.Group()
  const hand = new THREE.Object3D()
  hand.position.set(-0.3, 1, 0.3)
  body.add(hand)
  room.setAvatar({ root: body, update: () => undefined, hand: () => hand, reach: () => undefined, setView: () => undefined })
  room.look([0, 1.7, 0], [0, 0.1, -1.5])
  room.spawn(id, [0, 0, -1.5], 0)
  expect(room.grab()).toBe(true)
  run(room, 0.8)
  return room
}

describe('using an item in the hand without a liquid', () => {
  it('eats an apple in bites, the body brings it to the mouth, and it is gone with its nutrition told', () => {
    const room = holding('test_apple')
    const root = room.spawned()[0]!.root
    // F is the first use of what is in the hand
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }))
    expect(room.log.entries({ type: 'use_item' }).map((entry) => entry.data?.use)).toEqual(['eat_food'])
    run(room, 0.5)
    expect(room.avatarState().itemUse).toMatchObject({ id: 'eat_food', body: 'mouth' })
    run(room, 1.2)
    expect(root.scale.x).toBeLessThan(1)
    run(room, 2)
    const used = room.log.entries({ type: 'used_item' })
    expect(used).toHaveLength(1)
    // the body ate it: hunger and thirst fall by the apple's own satiety and hydration (from 20, plus the seconds that went by)
    expect(used[0]!.text).toBe('test_apple: satiety +8, hydration +6. Used up · hunger 20 → 12, thirst 20 → 14')
    expect(used[0]!.data?.hunger).toBeCloseTo(12.21, 2)
    expect(room.spawned()).toHaveLength(0)
  })

  it('rubs soap between both hands and keeps it', () => {
    const room = holding('test_soap')
    expect(room.useItem('use_hygiene')).toBe(true)
    run(room, 1)
    expect(room.avatarState().itemUse?.body).toBe('two_hands')
    run(room, 2.5)
    expect(room.log.entries({ type: 'used_item' })[0]!.text).toBe('test_soap: hands washed')
    expect(room.spawned()).toHaveLength(1)
    expect(room.spawned()[0]!.root.scale.x).toBe(1)
  })

  it('names the use in Portuguese and takes the medicine', () => {
    const room = holding('test_pills', 'pt-BR')
    expect(room.useItem('take_medicine')).toBe(true)
    expect(room.log.entries({ type: 'use_item' })[0]!.text).toBe('test_pills: tomar remédio')
    run(room, 3)
    expect(room.log.entries({ type: 'used_item' })[0]!.text).toBe('test_pills: +15 de vida. Acabou')
  })
})

describe('melee families in the room', () => {
  const struckBy = (tool: string, blows: number): string[] => {
    const struck: string[] = []
    const avatar: RoomAvatar = {
      root: new THREE.Group(),
      update: () => undefined,
      hand: () => new THREE.Object3D(),
      strike: (clip) => {
        struck.push(clip)
        return 0.2
      },
    }
    const room = makeRoom()
    room.setAvatar(avatar)
    room.setTool(tool)
    run(room, 0.5)
    for (let i = 0; i < blows; i++) {
      room.use()
      run(room, 0.7)
    }
    return struck
  }

  it('plays the same punch, shove and kick on the first-person arms as on the body', () => {
    const played: string[] = []
    const room = makeRoom({ firstPersonArms: { root: new THREE.Group(), update: () => undefined, dispose: () => undefined, play: (clip) => played.push(clip) > 0 } })
    room.setAvatar({ root: new THREE.Group(), update: () => undefined, hand: () => new THREE.Object3D(), strike: () => 0.2 })
    for (const tool of ['fists', 'shove']) {
      room.setTool(tool)
      run(room, 0.6)
      room.use()
      run(room, 0.8)
    }
    room.kick()
    run(room, 0.8)
    expect(played).toEqual(['punch_right', 'shove_two_hands', 'front_kick'])
  })

  it('cuts then thrusts with a knife, swings a bat as the shovel and chops with a machete', () => {
    expect(struckBy('knife', 3)).toEqual(['knife_slash', 'knife_stab', 'knife_slash'])
    expect(struckBy('baseball_bat', 1)).toEqual(['shovel_swing'])
    expect(struckBy('machete', 1)).toEqual(['knife_slash'])
    expect(DEFAULT_STRIKE_CLIPS.knife).toBe('knife_slash')
  })
})
