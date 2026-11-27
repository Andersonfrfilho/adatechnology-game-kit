import { describe, expect, it } from 'vitest'
import { eulerFromQuat, quatFromEuler, sampleClip } from '../src'
import type { AnimationClipSpec } from '../src'

const clipTo = (rotation: [number, number, number]): AnimationClipSpec => ({ id: 'open', duration: 1, keys: [{ t: 0, parts: { door: { rotation: [0, 0, 0] } } }, { t: 1, parts: { door: { rotation } } }] })

/** The door's normal (its local +z) after the turn: a door on a vertical hinge keeps it level. */
const normalOf = (q: readonly number[]): [number, number, number] => {
  const [x = 0, y = 0, z = 0, w = 1] = q
  return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)]
}

describe('sampleClip turns', () => {
  it('a door opening past 90 degrees given as Euler (180, 82, 180) stays in its horizontal plane all the way', () => {
    const open = 1.7
    // what a quaternion -> Euler XYZ conversion gives for 1.7 rad about y
    const euler = eulerFromQuat(quatFromEuler([0, open, 0]))
    expect(Math.abs(euler[0])).toBeCloseTo(Math.PI, 5)
    const clip = clipTo(euler)
    for (let i = 1; i < 10; i++) {
      const s = sampleClip(clip, 'door', i / 10)
      // only y turns: the normal never leaves the floor's plane, and the turn grows with time
      expect(Math.abs(normalOf(s.quaternion)[1])).toBeLessThan(1e-9)
      expect(Math.abs(s.quaternion[0])).toBeLessThan(1e-9)
      expect(Math.abs(s.quaternion[2])).toBeLessThan(1e-9)
      expect(2 * Math.atan2(s.quaternion[1], s.quaternion[3])).toBeCloseTo(open * (i / 10), 6)
    }
  })

  it('a turn about one axis is mixed as that angle, even past a full turn (a fan)', () => {
    const s = sampleClip(clipTo([0, 0, 4 * Math.PI]), 'door', 0.5)
    expect(s.rotation[2]).toBeCloseTo(2 * Math.PI, 9)
    const q = sampleClip(clipTo([0, 0, 4 * Math.PI]), 'door', 0.5).quaternion
    expect(Math.abs(q[3])).toBeCloseTo(1, 9) // a full turn, back where it started
  })

  it('rotation and quaternion are the same turn', () => {
    const s = sampleClip(clipTo([0.4, -0.9, 0.3]), 'door', 0.37)
    const q = quatFromEuler(s.rotation)
    const dot = Math.abs(q[0] * s.quaternion[0] + q[1] * s.quaternion[1] + q[2] * s.quaternion[2] + q[3] * s.quaternion[3])
    expect(dot).toBeCloseTo(1, 9)
  })
})
