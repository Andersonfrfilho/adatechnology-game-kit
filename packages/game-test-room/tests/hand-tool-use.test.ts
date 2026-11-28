import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { inEyeFrame } from '../src/hand-item-use'
import { createHandToolEffects } from '../src/hand-tool-use'
import { createLeafLocks } from '../src/leaf-locks'

const item = (): THREE.Object3D => {
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05)))
  return root
}

describe('tools used in the hand', () => {
  it('turns a flashlight on and off, the light at its lens', () => {
    const sounds: string[] = []
    const effects = createHandToolEffects({ THREE, sound: (key) => sounds.push(key), turnKey: () => 'air' })
    const root = item()
    expect(effects.act('switch', 'torch', root)).toBe('effect.light_on')
    expect(effects.isLit('torch')).toBe(true)
    expect(root.children).toHaveLength(2)
    expect(root.children[1]!.position.y).toBeCloseTo(0.08, 5)
    expect(effects.act('switch', 'torch', root)).toBe('effect.light_off')
    expect(effects.isLit('torch')).toBe(false)
    expect(root.children).toHaveLength(1)
    expect(sounds).toEqual(['flashlight_toggle', 'flashlight_toggle'])
  })

  it('lights a lighter with a flame over its top that flickers, and lets it go when the item leaves the world', () => {
    const effects = createHandToolEffects({ THREE, sound: () => undefined, turnKey: () => 'air' })
    const root = item()
    expect(effects.act('ignite', 'lighter', root)).toBe('effect.flame_on')
    const flame = root.getObjectByName('lighter-flame')!
    effects.update(0.05)
    const height = flame.scale.y
    effects.update(0.03)
    expect(flame.scale.y).not.toBe(height)
    effects.forget('lighter')
    expect(root.getObjectByName('lighter-flame')).toBeUndefined()
    expect(effects.act('bite', 'lighter', root)).toBeUndefined()
  })

  it('tells what the radio and the key did', () => {
    const effects = createHandToolEffects({ THREE, sound: () => undefined, turnKey: () => 'locked' })
    expect(effects.act('tune', 'radio', item())).toBe('effect.radio_tuned')
    expect(effects.act('talk', 'radio', item())).toBe('effect.radio_call')
    expect(effects.act('turn', 'key', item())).toBe('effect.key_locked')
  })
})

describe('leaf locks', () => {
  it('locks the leaf a key turns in, opens it and the whole object on the next turn, and turns in the air without a leaf', () => {
    const locks = createLeafLocks()
    expect(locks.turn({ objectId: 'outhouse', part: 'door', locked: false })).toBe('locked')
    expect(locks.isLocked('outhouse', 'door')).toBe(true)
    expect(locks.isLocked('outhouse', 'seat_lid')).toBe(false)
    locks.set('outhouse', true)
    expect(locks.turn({ objectId: 'outhouse', part: 'door', locked: true })).toBe('unlocked')
    expect(locks.isLocked('outhouse', 'door')).toBe(false)
    expect(locks.isLocked('outhouse', 'seat_lid')).toBe(false)
    expect(locks.turn(null)).toBe('air')
  })
})

describe('the eye frame of the hand uses', () => {
  const near = (got: readonly number[], want: readonly number[]): void => got.forEach((n, i) => expect(n).toBeCloseTo(want[i]!, 6))
  it('puts a point before a player facing -z ahead (-z), and turns with the yaw', () => {
    near(inEyeFrame([0, 1, -1], [0, 1.6, 0], 0), [0, -0.6, -1])
    // facing -x (yaw a quarter turn left), a point at -x is ahead
    near(inEyeFrame([-1, 1.6, 0], [0, 1.6, 0], Math.PI / 2), [0, 0, -1])
  })
})
