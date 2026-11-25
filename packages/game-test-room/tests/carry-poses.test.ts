import { describe, expect, it } from 'vitest'

import { bothHandsCarry, offHandCarryPose } from '../src/carry-poses'

const SHOULDERS = { R: [-0.2, 1.4, 0], L: [0.2, 1.4, 0] } as const

/** The hand's +y (the back of the hand) of a quaternion. */
const backOf = (q: readonly number[]): number[] => {
  const [x, y, z, w] = q as [number, number, number, number]
  return [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)]
}

describe('the hands on a thing carried', () => {
  it('a big thing in both hands sits in front of the chest, a palm on each side, the backs of the hands outward', () => {
    const { center, targets } = bothHandsCarry(SHOULDERS, 0, [0.45, 0.9, 0.45])
    expect(center[0]).toBeCloseTo(0)
    expect(center[2]).toBeLessThan(-0.3)
    expect(center[1]).toBeLessThan(1.4)
    expect(targets.R?.position[0]).toBeCloseTo(0.245)
    expect(targets.L?.position[0]).toBeCloseTo(-0.245)
    // the view's right is +x at yaw 0, and the right hand is the weapon hand on that side
    expect(backOf(targets.R!.quaternion)[0]).toBeCloseTo(1)
    expect(backOf(targets.L!.quaternion)[0]).toBeCloseTo(-1)
  })

  it('turns with the body', () => {
    const { center } = bothHandsCarry(SHOULDERS, Math.PI / 2, [0.4, 0.4, 0.4])
    expect(center[0]).toBeLessThan(-0.3)
    expect(center[2]).toBeCloseTo(0)
  })

  it('the left hand alone holds a small thing low and ahead of its shoulder', () => {
    const pose = offHandCarryPose(SHOULDERS.L, 0)
    expect(pose.position[1]).toBeCloseTo(1.0)
    expect(pose.position[2]).toBeLessThan(-0.2)
    expect(backOf(pose.quaternion)[0]).toBeCloseTo(-1)
  })
})
