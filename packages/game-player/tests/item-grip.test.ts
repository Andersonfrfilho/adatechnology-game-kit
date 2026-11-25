import { describe, expect, it } from 'vitest'

import { ITEM_GRIP, composePose, gripOfItem, handPoseOnItem, itemPoseInHand, rotateVector } from '../src'
import type { Pose } from '../src'

const close = (a: readonly number[], b: readonly number[], digits = 6): void => a.forEach((value, i) => expect(value).toBeCloseTo(b[i] ?? 0, digits))
const HAND: Pose = { position: [0.3, 1.1, -0.4], quaternion: [0, Math.sin(0.35), 0, Math.cos(0.35)] }

describe('a hand closing on a thing', () => {
  it('a bottle stands up the thumb of a right hand, its middle under the palm by a palm and its radius', () => {
    const bottle = [0.07, 0.25, 0.07]
    const grip = gripOfItem(bottle, 'R')
    // its own up (+y) runs along the thumb (-z of a right hand)
    close(rotateVector(grip.local.quaternion, [0, 1, 0]), [0, 0, -1])
    close(grip.local.position, [0, -(ITEM_GRIP.palm + 0.035), 0])
    expect(grip.grip).toBeGreaterThan(0.7)
    expect(grip.grip).toBeLessThanOrEqual(ITEM_GRIP.closed)
  })

  it('a left hand holds it the mirror way: up along +z', () => {
    close(rotateVector(gripOfItem([0.07, 0.25, 0.07], 'L').local.quaternion, [0, 1, 0]), [0, 0, 1])
  })

  it('a book lies with its broad face on the palm and its long side along the thumb', () => {
    const grip = gripOfItem([0.15, 0.03, 0.22], 'R')
    close(rotateVector(grip.local.quaternion, [0, 1, 0]), [0, 1, 0])
    close(rotateVector(grip.local.quaternion, [0, 0, 1]), [0, 0, -1])
    close(grip.local.position, [0, -(ITEM_GRIP.palm + 0.015), 0])
  })

  it('the turn is a rotation (no mirror) for every order of the sides', () => {
    for (const size of [[0.1, 0.2, 0.3], [0.3, 0.2, 0.1], [0.2, 0.3, 0.1], [0.1, 0.3, 0.2], [0.3, 0.1, 0.2], [0.2, 0.1, 0.3]]) {
      for (const hand of ['R', 'L'] as const) {
        const q = gripOfItem(size, hand).local.quaternion
        expect(Math.hypot(...q)).toBeCloseTo(1, 9)
        const x = rotateVector(q, [1, 0, 0])
        const y = rotateVector(q, [0, 1, 0])
        const z = rotateVector(q, [0, 0, 1])
        close([x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], z)
      }
    }
  })

  it('a thick thing opens the hand; it never opens past the least closure', () => {
    expect(gripOfItem([0.3, 0.3, 0.3], 'R').grip).toBe(ITEM_GRIP.open)
    expect(gripOfItem([0.01, 0.2, 0.01], 'R').grip).toBe(ITEM_GRIP.closed)
  })

  it('the hand that reaches the thing where it lies holds it there: reach and hold are one transform', () => {
    const grip = gripOfItem([0.07, 0.25, 0.07], 'R')
    const item = itemPoseInHand(HAND, grip)
    const back = handPoseOnItem(item, grip)
    close(back.position, HAND.position)
    close(composePose(back, grip.local).position, item.position)
    const dot = back.quaternion.reduce((sum, value, i) => sum + value * (HAND.quaternion[i] ?? 0), 0)
    expect(Math.abs(dot)).toBeCloseTo(1, 9)
  })
})
